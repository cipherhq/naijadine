import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ── User endpoints ──

  @Post('tickets')
  async createTicket(
    @Body() body: { subject: string; description: string; category?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.supportService.createTicket({ ...body, reporter_id: userId });
  }

  @Get('tickets/mine')
  async getMyTickets(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.supportService.getUserTickets(userId, page, limit);
  }

  @Get('tickets/:id')
  async getTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.getTicket(id);
  }

  @Post('tickets/:id/comments')
  async addComment(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body() body: { message: string; is_internal?: boolean },
    @CurrentUser('id') userId: string,
  ) {
    return this.supportService.addComment({
      ticket_id: ticketId,
      author_id: userId,
      message: body.message,
      is_internal: body.is_internal,
    });
  }

  // ── Admin endpoints ──

  @Get('admin/tickets')
  @UseGuards(AdminGuard)
  async getAllTickets(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.supportService.getAllTickets(page, limit, status, priority);
  }

  @Patch('admin/tickets/:id')
  @UseGuards(AdminGuard)
  async updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: string; priority?: string; assigned_to?: string },
  ) {
    return this.supportService.updateTicket(id, body);
  }
}
