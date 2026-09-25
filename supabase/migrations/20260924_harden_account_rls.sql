-- Prevent an authenticated client from moving an account to another user via
-- an UPDATE. USING controls which existing row is visible; WITH CHECK controls
-- the row after mutation, so both clauses are required.
drop policy if exists "Users can update own accounts" on public.accounts;

create policy "Users can update own accounts" on public.accounts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
