import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  async search(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('cuisine') cuisine?: string,
    @Query('price_range') priceRange?: string,
    @Query('sort') sort?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.searchService.search({
      q,
      city,
      cuisine,
      price_range: priceRange,
      sort,
      page,
      limit,
    });
  }

  @Post('reindex')
  @UseGuards(AuthGuard, AdminGuard)
  async reindex() {
    await this.searchService.reindexAll();
    return { success: true };
  }
}
