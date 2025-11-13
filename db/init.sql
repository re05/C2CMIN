CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL CHECK (status IN ('Active','Sold','Paused')),
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users(email,password,role) VALUES
  ('test@test.com','pass','user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO users(email,password,role) VALUES
  ('test2@test.com','pass','user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO users(email,password,role) VALUES
  ('ops@test.com','pass','admin')
ON CONFLICT (email) DO NOTHING;
