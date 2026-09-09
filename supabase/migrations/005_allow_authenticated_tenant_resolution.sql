-- Allow the admin client to resolve its tenant without exposing salon metadata.
--
-- PostgreSQL privileges are checked before RLS, so the existing salons policy
-- cannot be reached unless authenticated has SELECT on the requested column.
-- Grant only the id used by getContext(); RLS continues to decide which ids are
-- visible by consulting the canonical tenant_users membership table through
-- is_tenant_member().
grant select (id) on table public.salons to authenticated;

-- Recreate the policy explicitly for authenticated users so production cannot
-- accidentally rely on a policy left over from an older schema revision.
drop policy if exists "members read salons" on public.salons;
create policy "members read salons"
on public.salons
for select
to authenticated
using (public.is_tenant_member(id));
