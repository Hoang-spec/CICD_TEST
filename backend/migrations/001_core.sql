CREATE TABLE users (
 id text PRIMARY KEY, first_name text NOT NULL, last_name text NOT NULL,
 email text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'client' CHECK(role IN ('admin','client')),
 active boolean NOT NULL DEFAULT true, phone text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '', state text NOT NULL DEFAULT '', country text NOT NULL DEFAULT '',
 avatar text NOT NULL DEFAULT '', preferences jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users(lower(email));
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE categories (name text PRIMARY KEY CHECK(length(trim(name)) > 0));
CREATE TABLE products (
 id text PRIMARY KEY, name text NOT NULL, category text NOT NULL REFERENCES categories(name),
 description text NOT NULL DEFAULT '', price numeric(14,2) NOT NULL CHECK(price >= 0),
 old_price numeric(14,2) CHECK(old_price >= 0), image text NOT NULL DEFAULT '',
 accent text NOT NULL DEFAULT '#e4f0e8', badge text,
 stock integer NOT NULL CHECK(stock >= 0), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_active ON products(category,active);
CREATE TABLE orders (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), customer jsonb NOT NULL,
 payment_method text NOT NULL CHECK(payment_method = 'cod'), currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 status text NOT NULL CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
 subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0), shipping numeric(14,2) NOT NULL CHECK(shipping>=0),
 total numeric(14,2) NOT NULL CHECK(total=subtotal+shipping),
 idempotency_key text NOT NULL, request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX orders_user_date ON orders(user_id,created_at DESC,id);
CREATE INDEX orders_status_date ON orders(status,created_at DESC);
CREATE TABLE order_items (
 order_id text NOT NULL REFERENCES orders(id), product_id text NOT NULL REFERENCES products(id),
 name text NOT NULL, price numeric(14,2) NOT NULL CHECK(price>=0), quantity integer NOT NULL CHECK(quantity>0),
 PRIMARY KEY(order_id,product_id)
);
CREATE INDEX order_items_product ON order_items(product_id);
CREATE TABLE order_status_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id),
 from_status text, to_status text NOT NULL, actor_user_id text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_order ON order_status_history(order_id,created_at);
CREATE TABLE inventory_movements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id text NOT NULL REFERENCES products(id),
 order_id text REFERENCES orders(id), actor_user_id text REFERENCES users(id),
 kind text NOT NULL CHECK(kind IN ('opening','sale','cancel','adjustment')),
 quantity_delta integer NOT NULL CHECK(quantity_delta<>0), stock_after integer NOT NULL CHECK(stock_after>=0),
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_order_kind ON inventory_movements(order_id,product_id,kind) WHERE kind IN ('sale','cancel');
