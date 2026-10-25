-- Hasta ahora cualquier USER sin membresías como OPERATOR/VIEWER podía crear campos (dueños de
-- campo y productores recién creados sin campo). Esos pasan a FARM_ADMIN para conservar lo que
-- ya podían hacer; los USER que son operadores o lectores de algún campo quedan como USER.
UPDATE "users" u
SET "global_role" = 'FARM_ADMIN'
WHERE u."global_role" = 'USER'
  AND NOT EXISTS (
    SELECT 1
    FROM "farm_users" fu
    JOIN "roles" r ON r."id" = fu."role_id"
    WHERE fu."user_id" = u."id"
      AND fu."is_active" = true
      AND r."name" <> 'ADMIN'
  );
