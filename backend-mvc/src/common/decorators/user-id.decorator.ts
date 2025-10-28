import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const headers = request.headers as Record<string, unknown>;
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query as Record<string, unknown> | undefined;

    const headerId =
      typeof headers['x-user-id'] === 'string'
        ? headers['x-user-id']
        : undefined;
    const bodyCurrent =
      typeof body?.currentUserId === 'string' ? body.currentUserId : undefined;
    const bodyUser = typeof body?.userId === 'string' ? body.userId : undefined;
    const queryUser =
      typeof query?.userId === 'string' ? query.userId : undefined;

    return headerId || bodyCurrent || bodyUser || queryUser || null;
  },
);
