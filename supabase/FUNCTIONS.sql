-- ============================================================================
-- A K ENGINEERING - Analytics SQL functions
-- Replaces the 5 Mongoose aggregation pipeline shapes used by the API:
--   1. GET /api/leads/analytics/summary   ($facet: overview/status/source/owner/monthly/recent)
--   2. GET /api/revenue/overview          (4 facets: leads/quotations/projects/invoices)
--   3. GET /api/projects/summary          ($group + $project)
--   4. GET /api/projects/margin/overview  (Invoice $group totals)
--   5. ownerAssignment.js                 (least-loaded sales user)
--
-- All functions return jsonb shaped EXACTLY like the old Mongo $facet output
-- (arrays with `_id` keys) so the route-layer JS math works unchanged.
-- SECURITY: EXECUTE revoked from public; only service_role can call.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lead analytics summary ($facet equivalent)
-- ----------------------------------------------------------------------------
create or replace function public.lead_analytics_summary(
  p_months int,
  p_source_limit int,
  p_owner_limit int
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'overview', jsonb_build_array((
      select jsonb_build_object(
        'totalLeads', count(*),
        'newLeads', count(*) filter (where status = 'New'),
        'contactedLeads', count(*) filter (where status = 'Contacted'),
        'quotedLeads', count(*) filter (where status = 'Quoted'),
        'closedLeads', count(*) filter (where status = 'Closed'),
        'wonRevenue', coalesce(sum(deal_value) filter (where status = 'Closed'), 0),
        'pipelineRevenue', coalesce(sum(deal_value) filter (where status in ('New','Contacted','Quoted')), 0),
        'weightedPipelineRevenue', coalesce(sum(deal_value * probability / 100.0) filter (where status in ('New','Contacted','Quoted')), 0),
        'last7DaysLeads', count(*) filter (where created_at >= now() - interval '7 days'),
        'last30DaysLeads', count(*) filter (where created_at >= now() - interval '30 days')
      )
      from public.leads
    )),
    'statusDistribution', coalesce((
      select jsonb_agg(jsonb_build_object('_id', status, 'count', cnt) order by cnt desc, status asc)
      from (
        select status, count(*) as cnt
        from public.leads
        group by status
      ) s
    ), '[]'::jsonb),
    'sourceDistribution', coalesce((
      select jsonb_agg(jsonb_build_object('_id', src, 'count', cnt) order by cnt desc, src asc)
      from (
        select lower(btrim(coalesce(utm_source, ''))) as src, count(*) as cnt
        from public.leads
        group by 1
      ) s
      limit p_source_limit
    ), '[]'::jsonb),
    'ownerDistribution', coalesce((
      select jsonb_agg(jsonb_build_object('_id', ownr, 'count', cnt) order by cnt desc, ownr asc)
      from (
        select btrim(coalesce(owner, '')) as ownr, count(*) as cnt
        from public.leads
        group by 1
      ) s
      limit p_owner_limit
    ), '[]'::jsonb),
    'monthlyTrend', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', month_key,
        'leads', leads,
        'quotedLeads', quoted_leads,
        'closedLeads', closed_leads,
        'wonRevenue', won_revenue,
        'pipelineRevenue', pipeline_revenue
      ) order by month_key asc)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month_key,
          count(*) as leads,
          count(*) filter (where status = 'Quoted') as quoted_leads,
          count(*) filter (where status = 'Closed') as closed_leads,
          coalesce(sum(deal_value) filter (where status = 'Closed'), 0) as won_revenue,
          coalesce(sum(deal_value) filter (where status in ('New','Contacted','Quoted')), 0) as pipeline_revenue
        from public.leads
        where created_at >= date_trunc('month', now()) - (p_months - 1) * interval '1 month'
        group by 1
      ) t
    ), '[]'::jsonb),
    'recentLeads', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', id,
        'contactPerson', contact_person,
        'companyName', company_name,
        'status', status,
        'owner', owner,
        'utmSource', utm_source,
        'dealValue', deal_value,
        'createdAt', created_at
      ) order by created_at desc)
      from (select * from public.leads order by created_at desc limit 10) r
    ), '[]'::jsonb)
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Revenue overview - lead facet
-- ----------------------------------------------------------------------------
create or replace function public.revenue_lead_facet(p_months int, p_source_limit int)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totals', jsonb_build_array((
      select jsonb_build_object(
        'totalLeads', count(*),
        'openLeadCount', count(*) filter (where status in ('New','Contacted','Quoted')),
        'closedLeadCount', count(*) filter (where status = 'Closed'),
        'openPipelineValue', coalesce(sum(deal_value) filter (where status in ('New','Contacted','Quoted')), 0),
        'weightedPipelineValue', coalesce(sum(deal_value * probability / 100.0) filter (where status in ('New','Contacted','Quoted')), 0),
        'closedRevenue', coalesce(sum(deal_value) filter (where status = 'Closed'), 0)
      )
      from public.leads
    )),
    'sourceDistribution', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', src,
        'leads', leads,
        'pipelineValue', pipeline_value,
        'weightedValue', weighted_value
      ) order by weighted_value desc, leads desc, src asc)
      from (
        select
          lower(btrim(coalesce(utm_source, ''))) as src,
          count(*) as leads,
          coalesce(sum(deal_value) filter (where status in ('New','Contacted','Quoted')), 0) as pipeline_value,
          coalesce(sum(deal_value * probability / 100.0) filter (where status in ('New','Contacted','Quoted')), 0) as weighted_value
        from public.leads
        group by 1
      ) s
      limit p_source_limit
    ), '[]'::jsonb),
    'stageDistribution', coalesce((
      select jsonb_agg(jsonb_build_object('_id', status, 'count', cnt, 'value', val) order by cnt desc, status asc)
      from (
        select status, count(*) as cnt, coalesce(sum(deal_value), 0) as val
        from public.leads
        group by status
      ) s
    ), '[]'::jsonb),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', month_key,
        'leadsCreated', leads_created,
        'pipelineValueAdded', pipeline_added,
        'weightedPipelineAdded', weighted_added,
        'closedRevenueAdded', closed_added
      ) order by month_key asc)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month_key,
          count(*) as leads_created,
          coalesce(sum(deal_value) filter (where status in ('New','Contacted','Quoted')), 0) as pipeline_added,
          coalesce(sum(deal_value * probability / 100.0) filter (where status in ('New','Contacted','Quoted')), 0) as weighted_added,
          coalesce(sum(deal_value) filter (where status = 'Closed'), 0) as closed_added
        from public.leads
        where created_at >= date_trunc('month', now()) - (p_months - 1) * interval '1 month'
        group by 1
      ) t
    ), '[]'::jsonb)
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Revenue overview - quotation facet
-- ----------------------------------------------------------------------------
create or replace function public.revenue_quotation_facet(p_months int)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totals', jsonb_build_array((
      select jsonb_build_object(
        'totalQuotations', count(*),
        'draftCount', count(*) filter (where status = 'Draft'),
        'sentCount', count(*) filter (where status = 'Sent'),
        'approvedCount', count(*) filter (where status = 'Approved'),
        'rejectedCount', count(*) filter (where status = 'Rejected'),
        'sentValue', coalesce(sum(total_amount) filter (where status in ('Sent','Approved')), 0),
        'approvedValue', coalesce(sum(total_amount) filter (where status = 'Approved'), 0)
      )
      from public.quotations
    )),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', month_key,
        'quotationCount', quotation_count,
        'sentValue', sent_value,
        'approvedValue', approved_value
      ) order by month_key asc)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month_key,
          count(*) as quotation_count,
          coalesce(sum(total_amount) filter (where status in ('Sent','Approved')), 0) as sent_value,
          coalesce(sum(total_amount) filter (where status = 'Approved'), 0) as approved_value
        from public.quotations
        where created_at >= date_trunc('month', now()) - (p_months - 1) * interval '1 month'
        group by 1
      ) t
    ), '[]'::jsonb)
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. Revenue overview - project facet
-- ----------------------------------------------------------------------------
create or replace function public.revenue_project_facet(p_months int)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totals', jsonb_build_array((
      select jsonb_build_object(
        'totalProjects', count(*),
        'planningProjects', count(*) filter (where status = 'Planning'),
        'inProgressProjects', count(*) filter (where status = 'In Progress'),
        'completedProjects', count(*) filter (where status = 'Completed'),
        'totalProjectValue', coalesce(sum(project_value), 0),
        'activeProjectValue', coalesce(sum(project_value) filter (where status in ('Planning','In Progress')), 0),
        'completedProjectValue', coalesce(sum(project_value) filter (where status = 'Completed'), 0)
      )
      from public.projects
    )),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', month_key,
        'projectsBooked', projects_booked,
        'bookedValue', booked_value,
        'completedValue', completed_value
      ) order by month_key asc)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month_key,
          count(*) as projects_booked,
          coalesce(sum(project_value), 0) as booked_value,
          coalesce(sum(project_value) filter (where status = 'Completed'), 0) as completed_value
        from public.projects
        where created_at >= date_trunc('month', now()) - (p_months - 1) * interval '1 month'
        group by 1
      ) t
    ), '[]'::jsonb)
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Revenue overview - invoice facet
-- ----------------------------------------------------------------------------
create or replace function public.revenue_invoice_facet(p_months int)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totals', jsonb_build_array((
      select jsonb_build_object(
        'invoiceCount', count(*),
        'invoicedAmount', coalesce(sum(amount), 0),
        'receivedAmount', coalesce(sum(paid_amount), 0)
      )
      from public.invoices
    )),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', month_key,
        'invoiceCount', invoice_count,
        'invoicedAmount', invoiced_amount,
        'receivedAmount', received_amount
      ) order by month_key asc)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month_key,
          count(*) as invoice_count,
          coalesce(sum(amount), 0) as invoiced_amount,
          coalesce(sum(paid_amount), 0) as received_amount
        from public.invoices
        where created_at >= date_trunc('month', now()) - (p_months - 1) * interval '1 month'
        group by 1
      ) t
    ), '[]'::jsonb)
  );
$$;

-- ----------------------------------------------------------------------------
-- 6. Project summary ($group + $project)
-- ----------------------------------------------------------------------------
create or replace function public.project_summary()
returns jsonb
language sql
stable
as $$
  select jsonb_build_array((
    select jsonb_build_object(
      'totalProjects', count(*),
      'planningProjects', count(*) filter (where status = 'Planning'),
      'inProgressProjects', count(*) filter (where status = 'In Progress'),
      'completedProjects', count(*) filter (where status = 'Completed'),
      'totalProjectValue', coalesce(sum(project_value), 0),
      'totalSpent', coalesce(sum(total_spent), 0),
      'averageProgress', coalesce(avg(progress_percentage), 0)
    )
    from public.projects
  ));
$$;

-- ----------------------------------------------------------------------------
-- 7. Invoice totals ($group _id:null for margin overview)
-- ----------------------------------------------------------------------------
create or replace function public.invoice_totals()
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(jsonb_build_object(
    '_id', null,
    'invoicedAmount', coalesce(sum(amount), 0),
    'receivedAmount', coalesce(sum(paid_amount), 0)
  ))
  from public.invoices;
$$;

-- ----------------------------------------------------------------------------
-- 8. Owner load-balancing ($match + $group)
-- Returns rows shaped like Mongo: { _id: <ownerId>, count: n }
-- ----------------------------------------------------------------------------
create or replace function public.owner_lead_load(p_user_ids uuid[])
returns table("_id" uuid, count bigint)
language sql
stable
as $$
  select owner_id, count(*) as count
  from public.leads
  where owner_id = any(p_user_ids)
    and status <> 'Closed'
  group by owner_id
  order by count asc, owner_id asc;
$$;

-- ----------------------------------------------------------------------------
-- Least-loaded sales user (single query used by ownerAssignment.js)
-- ----------------------------------------------------------------------------
create or replace function public.least_loaded_sales_user(p_user_ids uuid[])
returns uuid
language sql
stable
as $$
  select u.id
  from public.users u
  left join (
    select owner_id, count(*) as open_count
    from public.leads
    where owner_id = any(p_user_ids) and status <> 'Closed'
    group by owner_id
  ) l on l.owner_id = u.id
  where u.id = any(p_user_ids) and u.role = 'sales'
  order by coalesce(l.open_count, 0) asc, lower(coalesce(u.name, u.email)) asc
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- Grants: service_role only
-- ----------------------------------------------------------------------------
revoke all on function public.lead_analytics_summary(int, int, int) from public;
revoke all on function public.revenue_lead_facet(int, int) from public;
revoke all on function public.revenue_quotation_facet(int) from public;
revoke all on function public.revenue_project_facet(int) from public;
revoke all on function public.revenue_invoice_facet(int) from public;
revoke all on function public.project_summary() from public;
revoke all on function public.invoice_totals() from public;
revoke all on function public.owner_lead_load(uuid[]) from public;
revoke all on function public.least_loaded_sales_user(uuid[]) from public;

grant execute on function public.lead_analytics_summary(int, int, int) to service_role;
grant execute on function public.revenue_lead_facet(int, int) to service_role;
grant execute on function public.revenue_quotation_facet(int) to service_role;
grant execute on function public.revenue_project_facet(int) to service_role;
grant execute on function public.revenue_invoice_facet(int) to service_role;
grant execute on function public.project_summary() to service_role;
grant execute on function public.invoice_totals() to service_role;
grant execute on function public.owner_lead_load(uuid[]) to service_role;
grant execute on function public.least_loaded_sales_user(uuid[]) to service_role;
