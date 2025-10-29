/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { LogHelper } from '../../common/helpers/log.helper';
import { v4 as uuidv4 } from 'uuid';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';

export interface RolePermission {
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  permissions: RolePermission[];
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class RolesService {
  constructor(private databaseService: DatabaseService) {}

  async create(
    createRoleDto: CreateRoleDto,
    currentUserId: string,
  ): Promise<Role> {
    const { name, description, status, permissions } = createRoleDto;

    // Check if role name already exists
    const existingRole = await this.databaseService.query(
      'SELECT id FROM roles WHERE name = $1',
      [name],
    );

    if (existingRole.rows.length > 0) {
      throw new ConflictException('Role name already exists');
    }

    const roleUuid = uuidv4();

    try {
      // Start transaction
      const client = await this.databaseService.getClient();
      await client.query('BEGIN');

      try {
        // Insert role (try legacy with UUID+status, fallback CK SERIAL without status)
        let roleId: string | number;
        try {
          const roleResult = await client.query(
            `INSERT INTO roles (id, name, description, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, description, status, created_at, updated_at`,
            [roleUuid, name, description, status || 'active'],
          );
          roleId = roleResult.rows[0].id;
        } catch {
          const roleResult = await client.query(
            `INSERT INTO roles (name, description)
             VALUES ($1, $2)
             RETURNING id, name, description, created_at, updated_at`,
            [name, description],
          );
          roleId = roleResult.rows[0].id;
        }

        // Insert permissions
        if (permissions && permissions.length > 0) {
          for (const permission of permissions) {
            try {
              await client.query(
                `INSERT INTO role_permissions (role_id, module, can_create, can_read, can_update, can_delete, can_approve)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  roleId,
                  permission.module,
                  permission.can_create || false,
                  permission.can_read || false,
                  permission.can_update || false,
                  permission.can_delete || false,
                  (permission as any).can_approve || false,
                ],
              );
            } catch {
              await client.query(
                `INSERT INTO role_permissions (role_id, module, can_create, can_read, can_update, can_delete)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  roleId,
                  permission.module,
                  permission.can_create || false,
                  permission.can_read || false,
                  permission.can_update || false,
                  permission.can_delete || false,
                ],
              );
            }
          }
        }

        await client.query('COMMIT');

        // Log the action (use LogHelper which is tolerant to schema differences)
        await LogHelper.createLog(this.databaseService, {
          userId: currentUserId,
          action: 'ROLE_CREATE',
          module: 'roles',
          description: `Created role: ${name}`,
          metadata: { roleId },
        });

        // Return the created role with permissions
        return await this.findOne(String(roleId));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw error;
    }
  }

  async findAll(query: any) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status, search } = query;

    let queryText = `
      SELECT r.id, r.name, r.description, r.status, r.created_at, r.updated_at
      FROM roles r
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      queryText += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (r.name ILIKE $${paramCount} OR r.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    queryText += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    let result;
    try {
      result = await this.databaseService.query(queryText, params);
    } catch {
      // CK schema without status column
      const ckQuery = `
        SELECT r.id, r.name, r.description, r.created_at, r.updated_at
        FROM roles r
        WHERE 1=1
        ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`;
      result = await this.databaseService.query(ckQuery, [limit, offset]);
      // patch rows with status='active'
      result.rows = result.rows.map((r: any) => ({ ...r, status: 'active' }));
    }

    // Get permissions for each role
    const rolesWithPermissions = await Promise.all(
      result.rows.map(async (role) => {
        const permissionsResult = await this.databaseService.query(
          `SELECT module, can_create, can_read, can_update, can_delete, can_approve
           FROM role_permissions
           WHERE role_id = $1`,
          [role.id],
        );

        return {
          ...role,
          permissions: permissionsResult.rows,
        };
      }),
    );

    // Get total count
    // Count fallback without relying on status
    let total = 0;
    try {
      let countQuery = 'SELECT COUNT(*) FROM roles WHERE 1=1';
      const countParams: any[] = [];
      if (status) {
        countQuery += ' AND status = $1';
        countParams.push(status);
      }
      if (search) {
        countQuery +=
          countParams.length > 0
            ? ' AND (name ILIKE $2 OR description ILIKE $2)'
            : ' AND (name ILIKE $1 OR description ILIKE $1)';
        countParams.push(`%${search}%`);
      }
      const countResult = await this.databaseService.query(
        countQuery,
        countParams,
      );
      total = parseInt(countResult.rows[0].count);
    } catch {
      const countResult = await this.databaseService.query(
        'SELECT COUNT(*) FROM roles',
      );
      total = parseInt(countResult.rows[0].count);
    }

    return {
      roles: rolesWithPermissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Role> {
    let roleResult;
    try {
      roleResult = await this.databaseService.query(
        `SELECT id, name, description, status, created_at, updated_at
         FROM roles
         WHERE id = $1`,
        [id],
      );
    } catch {
      roleResult = await this.databaseService.query(
        `SELECT id, name, description, created_at, updated_at
         FROM roles
         WHERE id = $1`,
        [id],
      );
      roleResult.rows = roleResult.rows.map((r: any) => ({
        ...r,
        status: 'active',
      }));
    }

    if (roleResult.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const role = roleResult.rows[0];

    // Get permissions for this role
    let permissionsResult;
    try {
      permissionsResult = await this.databaseService.query<RolePermission>(
        `SELECT module, can_create, can_read, can_update, can_delete, can_approve
         FROM role_permissions
         WHERE role_id = $1`,
        [id],
      );
    } catch {
      const res = await this.databaseService.query(
        `SELECT module, can_create, can_read, can_update, can_delete
         FROM role_permissions
         WHERE role_id = $1`,
        [id],
      );
      permissionsResult = {
        ...res,
        rows: res.rows.map((r: any) => ({ ...r, can_approve: false })),
      } as any;
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      status: role.status,
      created_at: role.created_at,
      updated_at: role.updated_at,
      permissions: permissionsResult.rows,
    } as Role;
  }

  async update(
    id: string,
    updateRoleDto: UpdateRoleDto,
    currentUserId: string,
  ): Promise<Role> {
    const { name, description, status, permissions } = updateRoleDto;

    // Check if role exists
    const existingRole = await this.databaseService.query(
      'SELECT * FROM roles WHERE id = $1',
      [id],
    );

    if (existingRole.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    // Check if new name conflicts with existing roles (excluding current role)
    if (name && name !== existingRole.rows[0].name) {
      const nameConflict = await this.databaseService.query(
        'SELECT id FROM roles WHERE name = $1 AND id != $2',
        [name, id],
      );

      if (nameConflict.rows.length > 0) {
        throw new ConflictException('Role name already exists');
      }
    }

    try {
      // Start transaction
      const client = await this.databaseService.getClient();
      await client.query('BEGIN');

      try {
        // Update role
        const updates: string[] = [];
        const params: any[] = [];
        let paramCount = 1;

        if (name !== undefined) {
          updates.push(`name = $${paramCount}`);
          params.push(name);
          paramCount++;
        }

        if (description !== undefined) {
          updates.push(`description = $${paramCount}`);
          params.push(description);
          paramCount++;
        }

        if (status !== undefined) {
          updates.push(`status = $${paramCount}`);
          params.push(status);
          paramCount++;
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          params.push(id);

          await client.query(
            `UPDATE roles SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            params,
          );
        }

        // Update permissions if provided
        if (permissions !== undefined) {
          // Delete existing permissions
          await client.query(
            'DELETE FROM role_permissions WHERE role_id = $1',
            [id],
          );

          // Insert new permissions
          if (permissions.length > 0) {
            for (const permission of permissions) {
              await client.query(
                `INSERT INTO role_permissions (role_id, module, can_create, can_read, can_update, can_delete, can_approve)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  id,
                  permission.module,
                  permission.can_create || false,
                  permission.can_read || false,
                  permission.can_update || false,
                  permission.can_delete || false,
                  permission.can_approve || false,
                ],
              );
            }
          }
        }

        await client.query('COMMIT');

        // Log the action
        await LogHelper.createLog(this.databaseService, {
          userId: currentUserId,
          action: 'ROLE_UPDATE',
          module: 'roles',
          description: `Updated role: ${name || existingRole.rows[0].name}`,
          metadata: { roleId: id },
        });

        // Return the updated role with permissions
        return await this.findOne(id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw error;
    }
  }

  async remove(id: string, currentUserId: string) {
    // Check if role exists
    const existingRole = await this.databaseService.query(
      'SELECT * FROM roles WHERE id = $1',
      [id],
    );

    if (existingRole.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    // Check if role is being used by any users
    const usersWithRole = await this.databaseService.query(
      'SELECT COUNT(*) FROM users WHERE role_id = $1',
      [id],
    );

    if (parseInt(usersWithRole.rows[0].count) > 0) {
      throw new ConflictException(
        'Cannot delete role that is assigned to users',
      );
    }

    // Soft delete (legacy) or hard delete (CK). Try soft delete, fallback hard delete
    try {
      await this.databaseService.query(
        'UPDATE roles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['inactive', id],
      );
    } catch {
      await this.databaseService.query('DELETE FROM roles WHERE id = $1', [id]);
    }

    // Log the action
    await LogHelper.createLog(this.databaseService, {
      userId: currentUserId,
      action: 'ROLE_DELETE',
      module: 'roles',
      description: `Deleted role: ${existingRole.rows[0].name}`,
      metadata: { roleId: id },
    });

    return { message: 'Role deleted successfully' };
  }

  async getStats() {
    const totalResult = await this.databaseService.query(
      'SELECT COUNT(*) FROM roles',
    );
    const totalRoles = parseInt(totalResult.rows[0].count);

    const activeResult = await this.databaseService.query(
      "SELECT COUNT(*) FROM roles WHERE status = 'active'",
    );
    const activeRoles = parseInt(activeResult.rows[0].count);

    const inactiveResult = await this.databaseService.query(
      "SELECT COUNT(*) FROM roles WHERE status = 'inactive'",
    );
    const inactiveRoles = parseInt(inactiveResult.rows[0].count);

    return {
      totalRoles,
      activeRoles,
      inactiveRoles,
    };
  }

  async getAvailableModules() {
    return [
      { name: 'Overview', label: 'Overview' },
      { name: 'Document', label: 'Document' },
      { name: 'History', label: 'History' },
      { name: 'Users', label: 'Users' },
      { name: 'Company Info', label: 'Company Info' },
      { name: 'Permissions', label: 'Permissions' },
      { name: 'Document Types', label: 'Document Types' },
      { name: 'Authentication', label: 'Authentication' },
      { name: 'Settings', label: 'Settings' },
    ];
  }

  async getUserPermissions(userId: string): Promise<RolePermission[]> {
    try {
      const result = await this.databaseService.query<RolePermission>(
        `SELECT rp.module, rp.can_create, rp.can_read, rp.can_update, rp.can_delete, rp.can_approve
         FROM role_permissions rp
         JOIN users u ON u.role_id = rp.role_id
         WHERE u.id = $1 AND rp.role_id IN (
           SELECT id FROM roles WHERE status = 'active'
         )`,
        [userId],
      );
      return result.rows;
    } catch {
      const res = await this.databaseService.query(
        `SELECT rp.module, rp.can_create, rp.can_read, rp.can_update, rp.can_delete
         FROM role_permissions rp
         JOIN users u ON u.role_id = rp.role_id
         WHERE u.id = $1`,
        [userId],
      );
      return (res.rows as any[]).map((r) => ({ ...r, can_approve: false }));
    }
  }

  async checkPermission(
    userId: string,
    module: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const modulePermission = permissions.find((p) => p.module === module);

    if (!modulePermission) {
      return false;
    }

    switch (action.toLowerCase()) {
      case 'create':
        return modulePermission.can_create;
      case 'read':
        return modulePermission.can_read;
      case 'update':
        return modulePermission.can_update;
      case 'delete':
        return modulePermission.can_delete;
      case 'approve':
        return modulePermission.can_approve;
      default:
        return false;
    }
  }
}

// PermissionsService - manages permissions through roles
@Injectable()
export class PermissionsService {
  constructor(private databaseService: DatabaseService) {}

  async create(createData: any, currentUserId: string) {
    try {
      const { role_name, description, permissions } = createData;

      // 1. Create new role in roles table
      const roleId = uuidv4();
      const roleResult = await this.databaseService.query(
        `INSERT INTO roles (id, name, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [
          roleId,
          role_name,
          description || `Custom role: ${role_name}`,
          'active',
        ],
      );

      const newRole = roleResult.rows[0];

      // 2. Parse permissions and create role_permissions entries
      let permissionsData: any = permissions;
      if (typeof permissions === 'string') {
        try {
          permissionsData = JSON.parse(permissions);
        } catch (e) {
          permissionsData = {};
        }
      }

      // 3. Convert frontend permissions format to role_permissions table format
      const modulesToInsert: any[] = [];

      if (Array.isArray(permissionsData)) {
        // Legacy format: ["OVERVIEW_CREATE", "OVERVIEW_READ"]
        const moduleMap = new Map<string, any>();

        permissionsData.forEach((perm: string) => {
          const parts = perm.split('_');
          const action = parts.pop()?.toLowerCase();
          const module = parts.join('_').toLowerCase();

          if (!moduleMap.has(module)) {
            moduleMap.set(module, {
              can_create: false,
              can_read: false,
              can_update: false,
              can_delete: false,
              can_approve: false,
            });
          }

          const modulePerms = moduleMap.get(module);
          if (action === 'create') modulePerms.can_create = true;
          if (action === 'read') modulePerms.can_read = true;
          if (action === 'update') modulePerms.can_update = true;
          if (action === 'delete') modulePerms.can_delete = true;
          if (action === 'approve') modulePerms.can_approve = true;
        });

        moduleMap.forEach((perms, module) => {
          modulesToInsert.push({ module, ...perms });
        });
      } else if (typeof permissionsData === 'object') {
        // New format: { "overview": {"create": true, "read": true} }
        Object.keys(permissionsData).forEach((module) => {
          const modulePerms = permissionsData[module];
          modulesToInsert.push({
            module: module.toLowerCase(),
            can_create: modulePerms.create || false,
            can_read: modulePerms.read || false,
            can_update: modulePerms.update || false,
            can_delete: modulePerms.delete || false,
            can_approve: modulePerms.approve || false,
          });
        });
      }

      // 4. Insert permissions into role_permissions table
      for (const modulePerm of modulesToInsert) {
        const permId = uuidv4();
        await this.databaseService.query(
          `INSERT INTO role_permissions 
           (id, role_id, module, can_create, can_read, can_update, can_delete, can_approve, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            permId,
            roleId,
            modulePerm.module,
            modulePerm.can_create,
            modulePerm.can_read,
            modulePerm.can_update,
            modulePerm.can_delete,
            modulePerm.can_approve || false,
          ],
        );
      }

      // 5. Log the action
      await LogHelper.createLog(this.databaseService, {
        userId: currentUserId,
        action: 'ROLE_CREATE',
        module: 'permissions',
        description: `Created role: ${role_name} with ${modulesToInsert.length} module permissions`,
        metadata: {
          role_name,
          role_id: roleId,
          modules: modulesToInsert.map((m) => m.module),
        },
      });

      return {
        ...newRole,
        role_name: newRole.name,
        permissions_count: modulesToInsert.length,
      };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error(`Role name "${createData.role_name}" already exists`);
      }
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, filters: any = {}) {
    try {
      const offset = (page - 1) * limit;

      let query = `
        SELECT r.*, 
               COUNT(DISTINCT rp.id) as permissions_count
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        query += ` AND r.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.role_name) {
        query += ` AND r.name ILIKE $${paramIndex}`;
        params.push(`%${filters.role_name}%`);
        paramIndex++;
      }

      query += ` GROUP BY r.id`;
      query += ` ORDER BY r.created_at DESC`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.databaseService.query(query, params);

      let countQuery = `SELECT COUNT(DISTINCT r.id) as count FROM roles r WHERE 1=1`;
      const countParams: any[] = [];
      let countIndex = 1;

      if (filters.status) {
        countQuery += ` AND r.status = $${countIndex}`;
        countParams.push(filters.status);
        countIndex++;
      }

      if (filters.role_name) {
        countQuery += ` AND r.name ILIKE $${countIndex}`;
        countParams.push(`%${filters.role_name}%`);
      }

      const countResult = await this.databaseService.query(
        countQuery,
        countParams,
      );
      const total = parseInt(countResult.rows[0].count);

      const permissions = await Promise.all(
        result.rows.map(async (row) => {
          const rolePerms = await this.databaseService.query(
            `SELECT module, can_create, can_read, can_update, can_delete, can_approve
             FROM role_permissions
             WHERE role_id = $1
             ORDER BY module`,
            [row.id],
          );

          const permsArray: string[] = [];
          rolePerms.rows.forEach((perm: any) => {
            const module = perm.module.toUpperCase();
            if (perm.can_create) permsArray.push(`${module}_CREATE`);
            if (perm.can_read) permsArray.push(`${module}_READ`);
            if (perm.can_update) permsArray.push(`${module}_UPDATE`);
            if (perm.can_delete) permsArray.push(`${module}_DELETE`);
            if (perm.can_approve) permsArray.push(`${module}_APPROVE`);
          });

          return {
            id: row.id,
            role_name: row.name,
            description: row.description,
            status: row.status,
            permissions: permsArray,
            permissions_count: parseInt(row.permissions_count) || 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        }),
      );

      return {
        permissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('Error in findAll:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const result = await this.databaseService.query(
        `SELECT * FROM roles WHERE id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        throw new NotFoundException('Role not found');
      }

      const role = result.rows[0];

      const permsResult = await this.databaseService.query(
        `SELECT module, can_create, can_read, can_update, can_delete, can_approve
         FROM role_permissions
         WHERE role_id = $1
         ORDER BY module`,
        [id],
      );

      const permsArray: string[] = [];
      permsResult.rows.forEach((perm: any) => {
        const module = perm.module.toUpperCase();
        if (perm.can_create) permsArray.push(`${module}_CREATE`);
        if (perm.can_read) permsArray.push(`${module}_READ`);
        if (perm.can_update) permsArray.push(`${module}_UPDATE`);
        if (perm.can_delete) permsArray.push(`${module}_DELETE`);
        if (perm.can_approve) permsArray.push(`${module}_APPROVE`);
      });

      return {
        id: role.id,
        role_name: role.name,
        description: role.description,
        status: role.status,
        permissions: permsArray,
        created_at: role.created_at,
        updated_at: role.updated_at,
      };
    } catch (error: any) {
      throw error;
    }
  }

  async update(id: string, updateData: any, currentUserId: string) {
    try {
      const { role_name, description, permissions, status } = updateData;

      const roleUpdates: string[] = [];
      const roleParams: any[] = [];
      let paramIndex = 1;

      if (role_name) {
        roleUpdates.push(`name = $${paramIndex}`);
        roleParams.push(role_name);
        paramIndex++;
      }

      if (description) {
        roleUpdates.push(`description = $${paramIndex}`);
        roleParams.push(description);
        paramIndex++;
      }

      if (status) {
        roleUpdates.push(`status = $${paramIndex}`);
        roleParams.push(status);
        paramIndex++;
      }

      if (roleUpdates.length > 0) {
        roleUpdates.push(`updated_at = NOW()`);
        roleParams.push(id);

        const roleQuery = `UPDATE roles 
                          SET ${roleUpdates.join(', ')} 
                          WHERE id = $${paramIndex}
                          RETURNING *`;

        await this.databaseService.query(roleQuery, roleParams);
      }

      if (permissions) {
        await this.databaseService.query(
          `DELETE FROM role_permissions WHERE role_id = $1`,
          [id],
        );

        let permissionsData: any = permissions;
        if (typeof permissions === 'string') {
          try {
            permissionsData = JSON.parse(permissions);
          } catch {
            permissionsData = {};
          }
        }

        const modulesToInsert: any[] = [];

        if (Array.isArray(permissionsData)) {
          const moduleMap = new Map<string, any>();

          permissionsData.forEach((perm: string) => {
            const parts = perm.split('_');
            const action = parts.pop()?.toLowerCase();
            const module = parts.join('_').toLowerCase();

            if (!moduleMap.has(module)) {
              moduleMap.set(module, {
                can_create: false,
                can_read: false,
                can_update: false,
                can_delete: false,
                can_approve: false,
              });
            }

            const modulePerms = moduleMap.get(module);
            if (action === 'create') modulePerms.can_create = true;
            if (action === 'read') modulePerms.can_read = true;
            if (action === 'update') modulePerms.can_update = true;
            if (action === 'delete') modulePerms.can_delete = true;
            if (action === 'approve') modulePerms.can_approve = true;
          });

          moduleMap.forEach((perms, module) => {
            modulesToInsert.push({ module, ...perms });
          });
        } else if (typeof permissionsData === 'object') {
          Object.keys(permissionsData).forEach((module) => {
            const modulePerms = permissionsData[module];
            modulesToInsert.push({
              module: module.toLowerCase(),
              can_create: modulePerms.create || false,
              can_read: modulePerms.read || false,
              can_update: modulePerms.update || false,
              can_delete: modulePerms.delete || false,
              can_approve: modulePerms.approve || false,
            });
          });
        }

        for (const modulePerm of modulesToInsert) {
          const permId = uuidv4();
          await this.databaseService.query(
            `INSERT INTO role_permissions 
             (id, role_id, module, can_create, can_read, can_update, can_delete, can_approve, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              permId,
              id,
              modulePerm.module,
              modulePerm.can_create,
              modulePerm.can_read,
              modulePerm.can_update,
              modulePerm.can_delete,
              modulePerm.can_approve || false,
            ],
          );
        }
      }

      await LogHelper.createLog(this.databaseService, {
        userId: currentUserId,
        action: 'ROLE_UPDATE',
        module: 'permissions',
        description: `Updated role: ${role_name || id}`,
        metadata: { role_id: id },
      });

      return this.findOne(id);
    } catch (error: any) {
      throw error;
    }
  }

  async remove(id: string, currentUserId: string) {
    try {
      const usersResult = await this.databaseService.query(
        `SELECT COUNT(*) as user_count FROM users WHERE role_id = $1`,
        [id],
      );

      const userCount = parseInt(usersResult.rows[0].user_count);
      if (userCount > 0) {
        throw new Error(
          `Cannot delete role. It is currently assigned to ${userCount} user(s).`,
        );
      }

      const roleResult = await this.databaseService.query(
        `SELECT name FROM roles WHERE id = $1`,
        [id],
      );

      if (roleResult.rows.length === 0) {
        throw new NotFoundException('Role not found');
      }

      const roleName = roleResult.rows[0].name;

      const deleteResult = await this.databaseService.query(
        `DELETE FROM roles WHERE id = $1 RETURNING *`,
        [id],
      );

      if (deleteResult.rows.length === 0) {
        throw new NotFoundException('Role not found');
      }

      await LogHelper.createLog(this.databaseService, {
        userId: currentUserId,
        action: 'ROLE_DELETE',
        module: 'permissions',
        description: `Deleted role: ${roleName}`,
        metadata: { role_id: id },
      });

      return {
        success: true,
        message: `Role "${roleName}" deleted successfully`,
      };
    } catch (error: any) {
      throw error;
    }
  }

  async getStats() {
    try {
      const result = await this.databaseService.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'active') as active,
           COUNT(*) FILTER (WHERE status = 'inactive') as inactive
         FROM roles`,
        [],
      );

      return result.rows[0];
    } catch (error: any) {
      throw error;
    }
  }
}
