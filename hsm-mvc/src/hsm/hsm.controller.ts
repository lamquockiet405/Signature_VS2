import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { HsmService } from './hsm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GenerateKeyDto } from './dto/generate-key.dto';
import { UnifiedSignDto } from './dto/unified-sign.dto';
import { ListKeysQueryDto, GetLogsQueryDto } from './dto/query.dto';

@Controller('hsm')
export class HsmController {
  constructor(private readonly hsmService: HsmService) {}

  // ========== Key Management ==========

  @Post('keys/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateKey(@Body() generateKeyDto: GenerateKeyDto, @Request() req) {
    const userId = req.user.id;
    const result = await this.hsmService.generateKeyPair({
      userId,
      keyType: generateKeyDto.keyType,
      keySize: generateKeyDto.keySize,
      keyLabel: generateKeyDto.keyLabel,
      keyUsage: generateKeyDto.keyUsage,
      metadata: generateKeyDto.metadata,
    });

    return {
      success: true,
      message: 'Key pair generated successfully in HSM',
      data: result,
    };
  }

  @Get('key/:id')
  @UseGuards(JwtAuthGuard)
  async getKey(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    const result = await this.hsmService.getKeyMetadata(id, userId);

    if (!result) {
      return {
        success: false,
        message: 'Key not found',
      };
    }

    return {
      success: true,
      data: result,
    };
  }

  // ========== Signing & Verify ==========

  @Post('sign')
  @UseGuards(JwtAuthGuard)
  async sign(@Body() unifiedSignDto: UnifiedSignDto, @Request() req) {
    const userId = req.user.id;
    const result = await this.hsmService.unifiedSign({
      keyId: unifiedSignDto.keyId,
      userId,
      type: unifiedSignDto.type,
      data: unifiedSignDto.data,
      algorithm: unifiedSignDto.algorithm,
      format: unifiedSignDto.format,
      signerInfo: unifiedSignDto.signerInfo,
      metadata: unifiedSignDto.metadata,
      fileName: unifiedSignDto.fileName,
      fileType: unifiedSignDto.fileType,
      fileSize: unifiedSignDto.fileSize,
      documentId: unifiedSignDto.documentId,
      documentName: unifiedSignDto.documentName,
      documentType: unifiedSignDto.documentType,
      documentSize: unifiedSignDto.documentSize,
      documentHash: unifiedSignDto.documentHash,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return {
      success: true,
      message: `${unifiedSignDto.type} signature created successfully`,
      data: result,
    };
  }
}
