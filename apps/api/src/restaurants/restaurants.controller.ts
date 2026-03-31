import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Public()
  @Get()
  async search(@Query() dto: SearchRestaurantsDto) {
    return this.restaurantsService.search(dto);
  }

  @Get('mine')
  async getMyRestaurants(@CurrentUser('id') userId: string) {
    return this.restaurantsService.getMyRestaurants(userId);
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.restaurantsService.findBySlug(slug);
  }

  @Public()
  @Get(':id/availability')
  async getAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('party_size') partySize: string,
  ) {
    if (!date) {
      return { message: 'Date query parameter is required' };
    }
    return this.restaurantsService.getAvailability(
      id,
      date,
      parseInt(partySize, 10) || 2,
    );
  }

  @Post()
  async create(
    @Body() dto: CreateRestaurantDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.restaurantsService.create(dto, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.restaurantsService.update(id, dto, userId);
  }
}
