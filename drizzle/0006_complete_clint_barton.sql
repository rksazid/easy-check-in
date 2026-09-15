--> Collapse any membership that was duplicated before this constraint existed,
--> keeping the most privileged row and, failing that, the oldest one.
DELETE FROM "member" m
 USING "member" keep
 WHERE m."organization_id" = keep."organization_id"
   AND m."user_id" = keep."user_id"
   AND m."id" <> keep."id"
   AND (
         CASE keep."role" WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
         keep."created_at",
         keep."id"
       ) < (
         CASE m."role" WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
         m."created_at",
         m."id"
       );--> statement-breakpoint
CREATE UNIQUE INDEX "member_one_per_user_per_org" ON "member" USING btree ("organization_id","user_id");