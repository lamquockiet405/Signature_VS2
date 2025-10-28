import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { LogHelper } from '../../../common/helpers/log.helper';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService {
  constructor(private databaseService: DatabaseService) {}

  async create(createUserDto: CreateUserDto) {
    const {
      username,
      email,
      password,
      role_id,
      role,
      full_name,
      phone,
      avatar_url,
    } = createUserDto;

    // Check if user already exists
    const existingUser = await this.databaseService.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email],
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictException('Username or email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    try {
      const result = await this.databaseService.query(
        `INSERT INTO users (id, username, email, password_hash, role_id, role, full_name, phone, avatar_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, username, email, role_id, role, full_name, phone, avatar_url, status, created_at`,
        [
          userId,
          username,
          email,
          password_hash,
          role_id || null,
          role || 'user',
          full_name,
          phone,
          avatar_url,
          'active',
        ],
      );

      // Log the action
      await LogHelper.createLog(this.databaseService, {
        userId: userId,
        action: 'USER_CREATE',
        module: 'users',
        description: `Created user: ${username}`,
        metadata: { userId, username, email, role: role || 'user' },
      });

      return result.rows[0];
    } catch (error) {
      // If avatar_url column doesn't exist, try without it
      const result = await this.databaseService.query(
        `INSERT INTO users (id, username, email, password_hash, role_id, role, full_name, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, username, email, role_id, role, full_name, phone, status, created_at`,
        [
          userId,
          username,
          email,
          password_hash,
          role_id || null,
          role || 'user',
          full_name,
          phone,
          'active',
        ],
      );

      await LogHelper.createLog(this.databaseService, {
        userId: userId,
        action: 'USER_CREATE',
        module: 'users',
        description: `Created user: ${username}`,
        metadata: { userId, username, email, role: role || 'user' },
      });

      return result.rows[0];
    }
  }

  async findAll(query: any) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;
    const { role } = query;

    let queryText = `
      SELECT u.id, u.username, u.email, u.role_id, u.role, u.full_name, u.phone, u.avatar_url, u.status, u.created_at, u.updated_at,
             r.name as role_name, r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (role) {
      queryText += ` AND (u.role = $${paramCount} OR r.name = $${paramCount})`;
      params.push(role);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await this.databaseService.query(queryText, params);

    let countQuery = `
      SELECT COUNT(*) 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    if (role) {
      countQuery += ' AND (u.role = $1 OR r.name = $1)';
      countParams.push(role);
    }

    const countResult = await this.databaseService.query(
      countQuery,
      countParams,
    );

    return {
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    };
  }

  async getStats() {
    const totalResult = await this.databaseService.query(
      'SELECT COUNT(*) FROM users',
    );
    const totalUsers = parseInt(totalResult.rows[0].count);

    const activeResult = await this.databaseService.query(
      "SELECT COUNT(*) FROM users WHERE status = 'active' OR role != 'inactive'",
    );
    const totalActiveUsers = parseInt(activeResult.rows[0].count);

    const draftResult = await this.databaseService.query(
      "SELECT COUNT(*) FROM users WHERE role = 'draft'",
    );
    const totalDraftUsers = parseInt(draftResult.rows[0].count);

    return {
      totalUsers,
      totalActiveUsers,
      totalDraftUsers,
    };
  }

  async findOne(id: string) {
    const result = await this.databaseService.query(
      `SELECT u.id, u.username, u.email, u.role_id, u.role, u.full_name, u.phone, u.avatar_url, u.status, u.created_at, u.updated_at,
              r.name as role_name, r.description as role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return result.rows[0];
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const userExists = await this.databaseService.query(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );

    if (userExists.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (updateUserDto.username) {
      updates.push(`username = $${paramCount}`);
      params.push(updateUserDto.username);
      paramCount++;
    }

    if (updateUserDto.email) {
      updates.push(`email = $${paramCount}`);
      params.push(updateUserDto.email);
      paramCount++;
    }

    if (updateUserDto.password) {
      const password_hash = await bcrypt.hash(updateUserDto.password, 10);
      updates.push(`password_hash = $${paramCount}`);
      params.push(password_hash);
      paramCount++;
    }

    if (updateUserDto.role_id !== undefined) {
      updates.push(`role_id = $${paramCount}`);
      params.push(updateUserDto.role_id);
      paramCount++;
    }

    if (updateUserDto.role) {
      updates.push(`role = $${paramCount}`);
      params.push(updateUserDto.role);
      paramCount++;
    }

    if (updateUserDto.full_name !== undefined) {
      updates.push(`full_name = $${paramCount}`);
      params.push(updateUserDto.full_name);
      paramCount++;
    }

    if (updateUserDto.phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      params.push(updateUserDto.phone);
      paramCount++;
    }

    if (updateUserDto.status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(updateUserDto.status);
      paramCount++;
    }

    if (updateUserDto.avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      params.push(updateUserDto.avatar_url);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const queryText = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, role_id, role, full_name, phone, avatar_url, status, created_at, updated_at
    `;

    const result = await this.databaseService.query(queryText, params);

    // Log the action
    if (updateUserDto.currentUserId) {
      await LogHelper.createLog(this.databaseService, {
        userId: updateUserDto.currentUserId,
        action: 'USER_UPDATE',
        module: 'users',
        description: `Updated user: ${updateUserDto.username || userExists.rows[0].username}`,
        metadata: { userId: id, updatedFields: Object.keys(updateUserDto) },
      });
    }

    return result.rows[0];
  }

  async remove(id: string, currentUserId: string) {
    const userExists = await this.databaseService.query(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );

    if (userExists.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const username = userExists.rows[0].username;

    await this.databaseService.query('DELETE FROM users WHERE id = $1', [id]);

    // Log the action
    await LogHelper.createLog(this.databaseService, {
      userId: currentUserId,
      action: 'USER_DELETE',
      module: 'users',
      description: `Deleted user: ${username}`,
      metadata: { deletedUserId: id, deletedUsername: username },
    });

    return { message: 'User deleted successfully' };
  }

  async getRoles() {
    try {
      const result = await this.databaseService.query(
        `SELECT id, name, description, status 
         FROM roles 
         WHERE status = 'active'
         ORDER BY name ASC`,
      );

      return {
        roles: result.rows,
        total: result.rows.length,
      };
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error;
    }
  }

  // Avatar management methods
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Get user to check if exists and get old avatar
    const userExists = await this.databaseService.query(
      'SELECT avatar_url FROM users WHERE id = $1',
      [userId],
    );

    if (userExists.rows.length === 0) {
      // Delete the uploaded file since user doesn't exist
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new NotFoundException('User not found');
    }

    // Delete old avatar if exists
    const oldAvatarUrl = userExists.rows[0].avatar_url;
    if (oldAvatarUrl) {
      const oldAvatarPath = path.join(
        './uploads/avatars',
        path.basename(oldAvatarUrl),
      );
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update avatar_url in database
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await this.databaseService.query(
      'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [avatarUrl, userId],
    );

    // Log the action
    await LogHelper.createLog(this.databaseService, {
      userId: userId,
      action: 'AVATAR_UPLOAD',
      module: 'users',
      description: `Uploaded avatar: ${file.filename}`,
      metadata: {
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
      },
    });

    return {
      filename: file.filename,
      path: file.path,
      avatarUrl,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async deleteAvatar(userId: string) {
    // Get user to check if exists and get avatar
    const userExists = await this.databaseService.query(
      'SELECT avatar_url FROM users WHERE id = $1',
      [userId],
    );

    if (userExists.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const avatarUrl = userExists.rows[0].avatar_url;
    if (!avatarUrl) {
      throw new NotFoundException('User has no avatar');
    }

    // Delete file from filesystem
    const avatarPath = path.join('./uploads/avatars', path.basename(avatarUrl));
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    // Update database to remove avatar_url
    await this.databaseService.query(
      'UPDATE users SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId],
    );

    // Log the action
    await LogHelper.createLog(this.databaseService, {
      userId: userId,
      action: 'AVATAR_DELETE',
      module: 'users',
      description: `Deleted avatar`,
      metadata: { deletedFile: path.basename(avatarUrl) },
    });
  }
}
