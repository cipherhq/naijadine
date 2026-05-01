'use client';

import { useEffect, useState, useRef } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

export default function MenuPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: 0 });
  const [uploading, setUploading] = useState(false);
  const [menuFileUrl, setMenuFileUrl] = useState<string | null>((restaurant as any).menu_url || null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadMenuFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${restaurant.id}/menu_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('menu-files')
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('menu-files').getPublicUrl(path);

    await supabase
      .from('restaurants')
      .update({ menu_url: urlData.publicUrl })
      .eq('id', restaurant.id);

    setMenuFileUrl(urlData.publicUrl);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function removeMenuFile() {
    await supabase
      .from('restaurants')
      .update({ menu_url: null })
      .eq('id', restaurant.id);
    setMenuFileUrl(null);
  }

  async function fetchMenu() {
    const { data: cats } = await supabase
      .from('menu_categories')
      .select('id, name, description, sort_order, is_active')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order');

    const { data: items } = await supabase
      .from('menu_items')
      .select('id, category_id, name, description, price, image_url, is_available, sort_order')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order');

    const categoriesWithItems = (cats || []).map((cat) => ({
      ...cat,
      items: (items || []).filter((item) => item.category_id === cat.id),
    }));

    setCategories(categoriesWithItems);
    setLoading(false);
  }

  useEffect(() => { fetchMenu(); }, [restaurant.id]);

  async function addCategory() {
    if (!newCatName.trim()) return;
    await supabase.from('menu_categories').insert({
      restaurant_id: restaurant.id,
      name: newCatName.trim(),
      sort_order: categories.length,
    });
    setNewCatName('');
    fetchMenu();
  }

  async function deleteCategory(id: string) {
    await supabase.from('menu_categories').delete().eq('id', id);
    fetchMenu();
  }

  async function addItem(categoryId: string) {
    if (!newItem.name.trim()) return;
    await supabase.from('menu_items').insert({
      category_id: categoryId,
      restaurant_id: restaurant.id,
      name: newItem.name.trim(),
      description: newItem.description.trim() || null,
      price: newItem.price,
      sort_order: 0,
    });
    setNewItem({ name: '', description: '', price: 0 });
    setAddingItemTo(null);
    fetchMenu();
  }

  async function toggleItemAvailability(id: string, current: boolean) {
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', id);
    fetchMenu();
  }

  async function deleteItem(id: string) {
    await supabase.from('menu_items').delete().eq('id', id);
    fetchMenu();
  }

  function formatPrice(amount: number) {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="mt-1 text-sm text-gray-500">
            {categories.length} categories &middot; {categories.reduce((s, c) => s + c.items.length, 0)} items
          </p>
        </div>
      </div>

      {/* Upload menu file (PDF/Image) */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900">Menu File</h3>
        <p className="mt-1 text-sm text-gray-500">Upload your menu as a PDF or image. Diners will see this on your restaurant page.</p>

        {menuFileUrl ? (
          <div className="mt-3 flex items-center gap-4">
            <a href={menuFileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-brand hover:bg-gray-50">
              📄 View Current Menu
            </a>
            <button onClick={removeMenuFile} className="text-sm text-red-500 hover:underline">Remove</button>
          </div>
        ) : (
          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={uploadMenuFile}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-600"
            />
            {uploading && (
              <span className="ml-2 text-sm text-gray-500">Uploading...</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">OR build your menu below</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Add category */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="New category (e.g. Starters, Main Course, Drinks)"
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-brand"
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button
          onClick={addCategory}
          disabled={!newCatName.trim()}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          + Add Category
        </button>
      </div>

      {/* Categories and items */}
      {categories.length === 0 ? (
        <div className="mt-12 text-center py-12">
          <p className="text-lg text-gray-400">No menu categories yet</p>
          <p className="mt-1 text-sm text-gray-300">Add categories like &quot;Starters&quot;, &quot;Main Course&quot;, &quot;Drinks&quot;</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Category header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                  {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingItemTo(addingItemTo === cat.id ? null : cat.id)}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                  >
                    + Add Item
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Add item form */}
              {addingItemTo === cat.id && (
                <div className="border-b border-gray-100 bg-brand-50/30 px-5 py-4">
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={newItem.price || ''}
                      onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                      className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <button
                      onClick={() => addItem(cat.id)}
                      disabled={!newItem.name.trim()}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Items */}
              {cat.items.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-gray-400">
                  No items in this category
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {cat.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${item.is_available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-gray-500 truncate">{item.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{formatPrice(item.price)}</span>
                      <button
                        onClick={() => toggleItemAvailability(item.id, item.is_available)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.is_available
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.is_available ? 'Available' : 'Sold Out'}
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-gray-300 hover:text-red-500"
                        aria-label="Delete item"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
