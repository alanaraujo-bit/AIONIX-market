-- Media URLs are origin-relative so they resolve through each frontend's /api proxy.
UPDATE "products" SET "image_url" = regexp_replace("image_url", '^https?://[^/]+', '') WHERE "image_url" ~ '^https?://[^/]+/api/media/';
UPDATE "media" SET "url" = regexp_replace("url", '^https?://[^/]+', '') WHERE "url" ~ '^https?://[^/]+/api/media/';
UPDATE "categories" SET "image_url" = regexp_replace("image_url", '^https?://[^/]+', '') WHERE "image_url" ~ '^https?://[^/]+/api/media/';
UPDATE "banners" SET "image_url" = regexp_replace("image_url", '^https?://[^/]+', '') WHERE "image_url" ~ '^https?://[^/]+/api/media/';
UPDATE "order_items" SET "image_url" = regexp_replace("image_url", '^https?://[^/]+', '') WHERE "image_url" ~ '^https?://[^/]+/api/media/';
