import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class LogsService {
  constructor(private databaseService: DatabaseService) {}

  /**
   * Create a new log entry
   */
  async create(logData: {
    user_id: string;
    username?: string;
    full_name?: string;
    email?: string;
    action: string;
    details?: string;
    ip_address?: string;
    user_agent?: string;
    response_time?: number;
    status?: string;
  }) {
    try {
      const result = await this.databaseService.query(
        `INSERT INTO logs (
          user_id, 
          username, 
          full_name, 
          email, 
          action, 
          details, 
          ip_address, 
          user_agent,
          response_time,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *`,
        [
          logData.user_id,
          logData.username || null,
          logData.full_name || null,
          logData.email || null,
          logData.action,
          logData.details || null,
          logData.ip_address || null,
          logData.user_agent || null,
          logData.response_time || null,
          logData.status || 'success',
        ],
      );
      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to create log:', error);
      throw error;
    }
  }

  async findAll(query: any) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const offset = (page - 1) * limit;
    const { userId, action } = query;

    let queryText = `
      SELECT l.*, u.username, u.full_name, u.email
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (userId) {
      queryText += ` AND l.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (action) {
      queryText += ` AND l.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    queryText += ` ORDER BY l.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await this.databaseService.query(queryText, params);

    let countQuery = 'SELECT COUNT(*) FROM logs WHERE 1=1';
    const countParams: any[] = [];
    if (userId) {
      countQuery += ' AND user_id = $1';
      countParams.push(userId);
    }
    if (action) {
      countQuery += ` AND action = $${countParams.length + 1}`;
      countParams.push(action);
    }

    const countResult = await this.databaseService.query(
      countQuery,
      countParams,
    );

    return {
      logs: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    };
  }

  async findOne(id: string) {
    const result = await this.databaseService.query(
      `SELECT l.*, u.username, u.full_name, u.email
       FROM logs l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Log not found');
    }

    return result.rows[0];
  }

  async getStatsSummary() {
    const result = await this.databaseService.query(`
      SELECT 
        action,
        COUNT(*) as count,
        MAX(created_at) as last_occurrence
      FROM logs
      GROUP BY action
      ORDER BY count DESC
    `);

    return {
      statistics: result.rows,
    };
  }

  async getActionStats(query: any) {
    const { period = 'weekly' } = query;

    const now = new Date();
    let currentPeriodStart: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;

    if (period === 'weekly') {
      currentPeriodStart = new Date(now);
      currentPeriodStart.setDate(now.getDate() - now.getDay());
      currentPeriodStart.setHours(0, 0, 0, 0);

      previousPeriodStart = new Date(currentPeriodStart);
      previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
      previousPeriodEnd = new Date(currentPeriodStart);
    } else if (period === 'monthly') {
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousPeriodEnd = new Date(currentPeriodStart);
    } else {
      currentPeriodStart = new Date(now.getFullYear(), 0, 1);
      previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
      previousPeriodEnd = new Date(currentPeriodStart);
    }

    const currentResult = await this.databaseService.query(
      `SELECT COUNT(*) as count FROM logs WHERE created_at >= $1`,
      [currentPeriodStart],
    );

    const previousResult = await this.databaseService.query(
      `SELECT COUNT(*) as count FROM logs WHERE created_at >= $1 AND created_at < $2`,
      [previousPeriodStart, previousPeriodEnd],
    );

    const currentCount = parseInt(currentResult.rows[0].count);
    const previousCount = parseInt(previousResult.rows[0].count);

    const change =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : currentCount > 0
          ? 100
          : 0;

    return {
      currentPeriod: currentCount,
      previousPeriod: previousCount,
      change: change,
      period: period,
    };
  }
}
