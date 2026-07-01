-- Create the Floor enum
CREATE TYPE "Floor" AS ENUM ('GF','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16');

-- users.floor: nullable string → nullable enum
-- Any existing value that doesn't match a valid member becomes NULL (safe for optional field)
ALTER TABLE "users"
  ADD COLUMN "floor_new" "Floor";

UPDATE "users"
  SET "floor_new" = CASE
    WHEN "floor" IN ('GF','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16')
    THEN "floor"::"Floor"
    ELSE NULL
  END;

ALTER TABLE "users" DROP COLUMN "floor";
ALTER TABLE "users" RENAME COLUMN "floor_new" TO "floor";

-- orders.floor: required string → required enum
-- Default any unrecognised legacy value to 'GF' so NOT NULL stays satisfied
ALTER TABLE "orders"
  ADD COLUMN "floor_new" "Floor";

UPDATE "orders"
  SET "floor_new" = CASE
    WHEN "floor" IN ('GF','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16')
    THEN "floor"::"Floor"
    ELSE 'GF'::"Floor"
  END;

ALTER TABLE "orders" DROP COLUMN "floor";
ALTER TABLE "orders" RENAME COLUMN "floor_new" TO "floor";
ALTER TABLE "orders" ALTER COLUMN "floor" SET NOT NULL;
