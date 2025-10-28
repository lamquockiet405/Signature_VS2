import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { FilteredLogHelper } from '../../../common/helpers/filtered-log.helper';
import { CreateDelegationDto } from '../../document/dtos/create-delegation.dto';
import { UpdateDelegationDto } from '../../document/dtos/update-delegation.dto';

@Injectable()
export class DelegationsService {
  constructor(private databaseService: DatabaseService) {}

  async getRoles() {
    const result = await this.databaseService.query(
      `SELECT DISTINCT reason FROM delegations WHERE reason LIKE 'Role:%'`,
      [],
    );

    const roles = result.rows
      .map((row) => {
        const match = row.reason.match(/Role:\s*(.+?)\s*-\s*(.+)/);
        if (match) {
          return {
            name: match[1].trim(),
            source: 'delegation',
            description: match[2].trim(),
          };
        }
        return null;
      })
      .filter((role) => role !== null);

    // Add default system roles
    const systemRoles = [
      {
        name: 'admin',
        source: 'system',
        description: 'Administrator with full access',
      },
      {
        name: 'manager',
        source: 'system',
        description: 'Manager with document management access',
      },
      {
        name: 'user',
        source: 'system',
        description: 'Standard user with basic access',
      },
    ];

    // Merge and deduplicate roles
    const allRoles = [...systemRoles, ...roles];
    const uniqueRoles = Array.from(
      new Map(allRoles.map((role) => [role.name, role])).values(),
    );

    return { roles: uniqueRoles };
  }

  async create(
    createDelegationDto: CreateDelegationDto,
    currentUserId: string,
  ) {
    const {
      delegator_id,
      delegate_id,
      document_id,
      permissions,
      reason,
      start_date,
      end_date,
    } = createDelegationDto;

    const delegatorResult = await this.databaseService.query(
      `SELECT * FROM users WHERE id = $1`,
      [delegator_id],
    );

    if (delegatorResult.rows.length === 0) {
      throw new NotFoundException('Delegator not found');
    }

    const delegateResult = await this.databaseService.query(
      `SELECT * FROM users WHERE id = $1`,
      [delegate_id],
    );

    if (delegateResult.rows.length === 0) {
      throw new NotFoundException('Delegate not found');
    }

    // Validate document_id if provided
    if (document_id) {
      const documentResult = await this.databaseService.query(
        `SELECT id FROM files WHERE id = $1`,
        [document_id],
      );
      if (documentResult.rows.length === 0) {
        throw new NotFoundException('Document not found');
      }
    }

    const id = uuidv4();
    const result = await this.databaseService.query(
      `INSERT INTO delegations (id, delegator_id, delegate_id, document_id, permissions, reason, created_at, expired_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
       RETURNING *`,
      [
        id,
        delegator_id,
        delegate_id,
        document_id || null,
        JSON.stringify(permissions),
        reason,
        end_date,
        'active',
      ],
    );

    await FilteredLogHelper.logDelegationOperation(this.databaseService, {
      userId: currentUserId,
      action: 'DELEGATION_CREATE',
      delegationId: id,
      delegatorName: delegator_id,
      delegateName: delegate_id,
      documentName: document_id,
      metadata: { delegator_id, delegate_id, document_id },
    });

    return result.rows[0];
  }

  async findAll(page: number = 1, limit: number = 1000, filters: any = {}) {
    const offset = (page - 1) * limit;
    let query = `SELECT d.*, 
                        u1.username as delegator_username, u1.full_name as delegator_name,
                        u2.username as delegate_username, u2.full_name as delegate_name,
                        f.original_name as document_name
                 FROM delegations d
                 LEFT JOIN users u1 ON d.delegator_id = u1.id
                 LEFT JOIN users u2 ON d.delegate_id = u2.id
                 LEFT JOIN files f ON d.document_id = f.id
                 WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.delegator_id) {
      query += ` AND d.delegator_id = $${paramIndex}`;
      params.push(filters.delegator_id);
      paramIndex++;
    }

    if (filters.delegate_id) {
      query += ` AND d.delegate_id = $${paramIndex}`;
      params.push(filters.delegate_id);
      paramIndex++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.databaseService.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM delegations d WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (filters.status) {
      countQuery += ` AND d.status = $${countParamIndex}`;
      countParams.push(filters.status);
      countParamIndex++;
    }

    if (filters.delegator_id) {
      countQuery += ` AND d.delegator_id = $${countParamIndex}`;
      countParams.push(filters.delegator_id);
      countParamIndex++;
    }

    if (filters.delegate_id) {
      countQuery += ` AND d.delegate_id = $${countParamIndex}`;
      countParams.push(filters.delegate_id);
      countParamIndex++;
    }

    const countResult = await this.databaseService.query(
      countQuery,
      countParams,
    );
    const total = parseInt(countResult.rows[0].count);

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const result = await this.databaseService.query(
      `SELECT d.*, 
              u1.username as delegator_username, u1.full_name as delegator_name,
              u2.username as delegate_username, u2.full_name as delegate_name
       FROM delegations d
       LEFT JOIN users u1 ON d.delegator_id = u1.id
       LEFT JOIN users u2 ON d.delegate_id = u2.id
       WHERE d.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Delegation not found');
    }

    return result.rows[0];
  }

  async update(
    id: string,
    updateDelegationDto: UpdateDelegationDto,
    currentUserId: string,
  ) {
    const delegation = await this.findOne(id);

    const userResult = await this.databaseService.query(
      `SELECT * FROM users WHERE id = $1`,
      [currentUserId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult.rows[0];

    // Allow admin, delegator (owner), or delegate (signer) to update
    const isAdmin = user.role === 'admin';
    const isDelegator = delegation.delegator_id === currentUserId;
    const isDelegate = delegation.delegate_id === currentUserId;

    if (!isAdmin && !isDelegator && !isDelegate) {
      throw new ForbiddenException(
        'You can only update delegations where you are the delegator or delegate',
      );
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updateDelegationDto.permissions !== undefined) {
      updateFields.push(`permissions = $${paramIndex}`);
      updateValues.push(JSON.stringify(updateDelegationDto.permissions));
      paramIndex++;
    }

    if (updateDelegationDto.reason !== undefined) {
      updateFields.push(`reason = $${paramIndex}`);
      updateValues.push(updateDelegationDto.reason);
      paramIndex++;
    }

    if (updateDelegationDto.start_date !== undefined) {
      updateFields.push(`start_date = $${paramIndex}`);
      updateValues.push(updateDelegationDto.start_date);
      paramIndex++;
    }

    if (updateDelegationDto.end_date !== undefined) {
      updateFields.push(`end_date = $${paramIndex}`);
      updateValues.push(updateDelegationDto.end_date);
      paramIndex++;
    }

    if (updateDelegationDto.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(updateDelegationDto.status);
      paramIndex++;
    }

    // Handle metadata field (important for signature drafts in approval workflows)
    if ((updateDelegationDto as any).metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      updateValues.push(JSON.stringify((updateDelegationDto as any).metadata));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return delegation;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(id);

    const query = `UPDATE delegations 
                   SET ${updateFields.join(', ')}
                   WHERE id = $${paramIndex}
                   RETURNING *`;

    const result = await this.databaseService.query(query, updateValues);

    await FilteredLogHelper.logDelegationOperation(this.databaseService, {
      userId: currentUserId,
      action: 'DELEGATION_UPDATE',
      delegationId: id,
      delegatorName: 'Unknown',
      delegateName: 'Unknown',
      metadata: { delegationId: id },
    });

    return result.rows[0];
  }

  async remove(id: string, currentUserId: string) {
    const delegation = await this.findOne(id);

    const userResult = await this.databaseService.query(
      `SELECT * FROM users WHERE id = $1`,
      [currentUserId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult.rows[0];

    if (user.role !== 'admin' && delegation.delegator_id !== currentUserId) {
      throw new ForbiddenException('You can only delete your own delegations');
    }

    await this.databaseService.query(
      `UPDATE delegations SET status = $1, revoked_at = NOW() WHERE id = $2`,
      ['revoked', id],
    );

    await FilteredLogHelper.logDelegationOperation(this.databaseService, {
      userId: currentUserId,
      action: 'DELEGATION_DELETE',
      delegationId: id,
      delegatorName: 'Unknown',
      delegateName: 'Unknown',
      metadata: { delegationId: id },
    });

    return { message: 'Delegation revoked successfully' };
  }

  async getStats(period?: string) {
    // Calculate date range based on period
    let dateCondition = '';
    if (period === 'day') {
      dateCondition = `AND d.created_at >= NOW() - INTERVAL '1 day'`;
    } else if (period === 'week') {
      dateCondition = `AND d.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateCondition = `AND d.created_at >= NOW() - INTERVAL '30 days'`;
    } else if (period === 'year') {
      dateCondition = `AND d.created_at >= NOW() - INTERVAL '365 days'`;
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'signed') as signed,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM delegations d
      WHERE 1=1 ${dateCondition}
    `;

    const result = await this.databaseService.query(statsQuery, []);
    const stats = result.rows[0];

    return {
      total: parseInt(stats.total) || 0,
      pending: parseInt(stats.pending) || 0,
      signed: parseInt(stats.signed) || 0,
      rejected: parseInt(stats.rejected) || 0,
      cancelled: parseInt(stats.cancelled) || 0,
    };
  }
}
