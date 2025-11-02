-- Remove highlight budget limit enforcement to allow unlimited highlights
DROP TRIGGER IF EXISTS user_highlight_budgets_limit ON public.user_highlight_budgets;
DROP FUNCTION IF EXISTS public.user_highlight_budgets_enforce_limit();
