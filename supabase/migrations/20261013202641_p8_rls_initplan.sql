-- Advisor finding 0003: evaluate the request identity once per statement.
-- Identical authorization predicates; no grants or ownership rules change.
begin;
alter policy own_read on public."PYRUnibague_UserProfiles" using (user_id=(select auth.uid()));
alter policy own_update on public."PYRUnibague_UserProfiles" using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
alter policy own_roles on public."PYRUnibague_UserRoles" using (user_id=(select auth.uid()));
alter policy own_read on public."PYRUnibague_Students" using (user_id=(select auth.uid()) and public.pyr_unibague_has_role('STUDENT'));
alter policy own_create on public."PYRUnibague_Students" with check (user_id=(select auth.uid()) and public.pyr_unibague_has_role('STUDENT'));
alter policy own_update on public."PYRUnibague_Students" using (user_id=(select auth.uid()) and public.pyr_unibague_has_role('STUDENT')) with check (user_id=(select auth.uid()) and public.pyr_unibague_has_role('STUDENT'));
alter policy own_read on public."PYRUnibague_Notifications" using (user_id=(select auth.uid()));
alter policy advisor_self on public."PYRUnibague_StaffProfiles" using (user_id=(select auth.uid()) and public.pyr_unibague_has_role('ADVISOR'));
alter policy advisor_self on public."PYRUnibague_AdvisorOrganizationAssignments" using (
 is_current and public.pyr_unibague_has_role('ADVISOR') and exists(select 1 from public."PYRUnibague_StaffProfiles" s where s.id=advisor_id and s.user_id=(select auth.uid()) and s.status='active'));
alter policy advisor_self on public."PYRUnibague_AdvisorStudentAssignments" using (
 is_current and public.pyr_unibague_has_role('ADVISOR') and exists(select 1 from public."PYRUnibague_StaffProfiles" s where s.id=advisor_id and s.user_id=(select auth.uid()) and s.status='active'));
commit;
