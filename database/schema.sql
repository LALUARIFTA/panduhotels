-- ══════════════════════════════════════════════════════════
-- PANDU HOTEL — Supabase Database Schema
-- Jalankan SQL ini di Supabase SQL Editor (Dashboard > SQL Editor)
-- ══════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────┐
-- │ 1. PROFILES TABLE                       │
-- │    Extended user data (linked to auth)  │
-- └─────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'staff')),
  reward_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ┌─────────────────────────────────────────┐
-- │ 2. HOTELS TABLE                         │
-- │    Hotel listings managed by admin      │
-- └─────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  area TEXT,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  capacity TEXT DEFAULT '2 tamu',
  stock INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for public listing queries
CREATE INDEX IF NOT EXISTS idx_hotels_status ON hotels(status);
CREATE INDEX IF NOT EXISTS idx_hotels_location ON hotels(location);

-- ┌─────────────────────────────────────────┐
-- │ 3. BOOKINGS TABLE                       │
-- │    Reservation records                  │
-- └─────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  hotel_name TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_note TEXT,
  base_price INTEGER NOT NULL,
  addon_total INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  points_discount INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'virtual_account',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  addons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(code);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);

-- ┌─────────────────────────────────────────┐
-- │ 4. ROW LEVEL SECURITY (RLS)             │
-- │    Database-level access control        │
-- └─────────────────────────────────────────┘

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- PROFILES: Users can update their own profile (but not role)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PROFILES: Service role can do everything (for server-side)
DROP POLICY IF EXISTS "Service role full access on profiles" ON profiles;
CREATE POLICY "Service role full access on profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- HOTELS: Everyone can read active hotels
DROP POLICY IF EXISTS "Public can read active hotels" ON hotels;
CREATE POLICY "Public can read active hotels"
  ON hotels FOR SELECT
  USING (status = 'active');

-- HOTELS: Service role can do everything
DROP POLICY IF EXISTS "Service role full access on hotels" ON hotels;
CREATE POLICY "Service role full access on hotels"
  ON hotels FOR ALL
  USING (auth.role() = 'service_role');

-- BOOKINGS: Users can read their own bookings
DROP POLICY IF EXISTS "Users can read own bookings" ON bookings;
CREATE POLICY "Users can read own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

-- BOOKINGS: Users can create bookings for themselves
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- BOOKINGS: Service role can do everything
DROP POLICY IF EXISTS "Service role full access on bookings" ON bookings;
CREATE POLICY "Service role full access on bookings"
  ON bookings FOR ALL
  USING (auth.role() = 'service_role');

-- ┌─────────────────────────────────────────┐
-- │ 5. DATABASE FUNCTIONS                   │
-- │    Helper functions for atomic ops      │
-- └─────────────────────────────────────────┘

-- Function to increment reward points atomically
CREATE OR REPLACE FUNCTION increment_points(user_id UUID, points INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reward_points = reward_points + points,
      updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment hotel stock (for cancellations)
CREATE OR REPLACE FUNCTION increment_stock(target_hotel_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  UPDATE hotels
  SET stock = stock + 1,
      updated_at = now()
  WHERE id = target_hotel_id
  RETURNING stock INTO new_stock;
  RETURN new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement hotel stock (for new bookings)
CREATE OR REPLACE FUNCTION decrement_stock(target_hotel_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  UPDATE hotels
  SET stock = stock - 1,
      updated_at = now()
  WHERE id = target_hotel_id AND stock > 0
  RETURNING stock INTO new_stock;
  RETURN new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────┐
-- │ 6. SEED DATA (Opsional)                 │
-- │    Data awal untuk testing              │
-- └─────────────────────────────────────────┘

INSERT INTO hotels (name, location, area, rating, price, description, tags, image_url, capacity, stock) VALUES
  ('Pandu Grand Jakarta', 'jakarta', 'Sudirman, Jakarta', 4.8, 1180000,
   'Hotel bisnis premium dekat pusat perkantoran dengan check-in cepat dan lounge eksekutif.',
   ARRAY['wifi', 'breakfast', 'airport'],
   'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=82',
   '2 tamu', 18),

  ('Pandu Ocean Resort', 'bali', 'Nusa Dua, Bali', 4.9, 1960000,
   'Resort tepi pantai dengan kolam luas, spa, dan paket honeymoon fleksibel.',
   ARRAY['wifi', 'pool', 'breakfast'],
   'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=82',
   '2 tamu', 7),

  ('Pandu Hills Bandung', 'bandung', 'Dago Pakar, Bandung', 4.7, 1420000,
   'Penginapan sejuk untuk keluarga dengan kamar luas dan akses cepat ke wisata kuliner.',
   ARRAY['wifi', 'pool', 'airport'],
   'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=82',
   '4 tamu', 5),

  ('Pandu Lombok Retreat', 'lombok', 'Kuta, Lombok', 4.9, 1650000,
   'Retret eksklusif di Kuta Mandalika dengan pemandangan bukit dan akses dekat sirkuit.',
   ARRAY['wifi', 'pool', 'breakfast'],
   'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82',
   '2 tamu', 10)
ON CONFLICT DO NOTHING;

-- ┌─────────────────────────────────────────┐
-- │ 7. STORAGE BUCKET                       │
-- │    Buat di Dashboard > Storage          │
-- │    Nama bucket: hotel-images            │
-- │    Public: Yes                          │
-- └─────────────────────────────────────────┘

-- Catatan: Bucket storage harus dibuat manual di Supabase Dashboard.
-- Buka Storage > New Bucket > Nama: "hotel-images" > Public: ON
