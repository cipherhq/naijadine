import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';

interface MeilisearchDocument {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  neighborhood: string;
  cuisine_types: string[];
  price_range: string;
  avg_rating: number;
  total_reviews: number;
  business_category: string;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly host: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;
  private readonly indexName = 'restaurants';

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.host = this.configService.get<string>('MEILISEARCH_HOST') || '';
    this.apiKey = this.configService.get<string>('MEILISEARCH_API_KEY') || '';
    this.enabled = !!(this.host && this.apiKey);

    if (!this.enabled) {
      this.logger.warn('Meilisearch disabled: host/key not configured');
    }
  }

  async onModuleInit() {
    if (!this.enabled) return;

    // Configure index settings
    try {
      await this.meiliRequest(`/indexes/${this.indexName}`, 'POST', {
        uid: this.indexName,
        primaryKey: 'id',
      });

      await this.meiliRequest(
        `/indexes/${this.indexName}/settings`,
        'PATCH',
        {
          searchableAttributes: [
            'name',
            'description',
            'cuisine_types',
            'city',
            'neighborhood',
          ],
          filterableAttributes: [
            'city',
            'neighborhood',
            'cuisine_types',
            'price_range',
            'business_category',
          ],
          sortableAttributes: ['avg_rating', 'total_reviews', 'name'],
          rankingRules: [
            'words',
            'typo',
            'proximity',
            'attribute',
            'sort',
            'exactness',
          ],
        },
      );

      this.logger.log('Meilisearch index configured');
    } catch (err) {
      this.logger.error(`Meilisearch setup failed: ${err}`);
    }
  }

  private async meiliRequest(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<unknown> {
    const response = await fetch(`${this.host}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return response.json();
  }

  /**
   * Index a single restaurant (call after create/update)
   */
  async indexRestaurant(restaurantId: string) {
    if (!this.enabled) return;

    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, description, city, neighborhood, cuisine_types, price_range, avg_rating, total_reviews, business_category')
      .eq('id', restaurantId)
      .eq('status', 'active')
      .single();

    if (!data) return;

    await this.meiliRequest(
      `/indexes/${this.indexName}/documents`,
      'POST',
      [data],
    );
  }

  /**
   * Remove a restaurant from the index
   */
  async removeRestaurant(restaurantId: string) {
    if (!this.enabled) return;

    await this.meiliRequest(
      `/indexes/${this.indexName}/documents/${restaurantId}`,
      'DELETE',
    );
  }

  /**
   * Full reindex of all active restaurants
   */
  async reindexAll() {
    if (!this.enabled) return;

    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, description, city, neighborhood, cuisine_types, price_range, avg_rating, total_reviews, business_category')
      .eq('status', 'active');

    if (!data?.length) return;

    await this.meiliRequest(
      `/indexes/${this.indexName}/documents`,
      'POST',
      data,
    );

    this.logger.log(`Indexed ${data.length} restaurants`);
  }

  /**
   * Search restaurants
   */
  async search(params: {
    q?: string;
    city?: string;
    cuisine?: string;
    price_range?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    if (!this.enabled) {
      // Fallback to Supabase search
      return this.fallbackSearch(params);
    }

    const filters: string[] = [];
    if (params.city) filters.push(`city = "${params.city}"`);
    if (params.cuisine)
      filters.push(`cuisine_types = "${params.cuisine}"`);
    if (params.price_range)
      filters.push(`price_range = "${params.price_range}"`);

    const page = params.page || 1;
    const limit = params.limit || 20;

    const result = await this.meiliRequest(
      `/indexes/${this.indexName}/search`,
      'POST',
      {
        q: params.q || '',
        filter: filters.length ? filters.join(' AND ') : undefined,
        sort: params.sort
          ? [params.sort]
          : ['avg_rating:desc'],
        offset: (page - 1) * limit,
        limit,
      },
    ) as { hits: MeilisearchDocument[]; estimatedTotalHits: number };

    return {
      data: result.hits || [],
      total: result.estimatedTotalHits || 0,
      page,
      limit,
    };
  }

  private async fallbackSearch(params: {
    q?: string;
    city?: string;
    cuisine?: string;
    price_range?: string;
    page?: number;
    limit?: number;
  }) {
    const supabase = this.supabaseService.getClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('restaurants')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.q) {
      query = query.ilike('name', `%${params.q}%`);
    }
    if (params.city) {
      query = query.eq('city', params.city);
    }
    if (params.cuisine) {
      query = query.contains('cuisine_types', [params.cuisine]);
    }
    if (params.price_range) {
      query = query.eq('price_range', params.price_range);
    }

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page, limit };
  }
}
