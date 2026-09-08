-- Migration: Retire unsupported consumer interpretations while retaining history.
-- Rollback: Use a compatible evidence-first build and reviewed forward repair; retain queue/history rows.
-- Retire unsupported consumer interpretations without deleting stored history,
-- user preferences, watches, queue records, recipe rows or earned milestones.
BEGIN;

CREATE OR REPLACE FUNCTION public.queue_score_change_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Score audit/history insertion continues; it no longer creates health alerts.
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_score_change_notifications() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.api_get_pending_notifications(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('notifications','[]'::jsonb,'total',0,
    'dispatch_paused',true,'reason','unsupported_aggregate');
$$;
REVOKE ALL ON FUNCTION public.api_get_pending_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_get_pending_notifications(integer) TO service_role;

-- Preserve the historical mathematical implementations in a service-owned audit
-- namespace while the public entrypoints refuse to imply current validity.
DO $$
BEGIN
  IF to_regprocedure('evidence_private.legacy_recipe_score_v1(text)') IS NULL THEN
    ALTER FUNCTION public.api_get_recipe_score(text) SET SCHEMA evidence_private;
    ALTER FUNCTION evidence_private.api_get_recipe_score(text) RENAME TO legacy_recipe_score_v1;
  END IF;
  IF to_regprocedure('evidence_private.legacy_recipe_nutrition_v1(text)') IS NULL THEN
    ALTER FUNCTION public.api_get_recipe_nutrition(text) SET SCHEMA evidence_private;
    ALTER FUNCTION evidence_private.api_get_recipe_nutrition(text) RENAME TO legacy_recipe_nutrition_v1;
  END IF;
END $$;
REVOKE ALL ON FUNCTION evidence_private.legacy_recipe_score_v1(text),evidence_private.legacy_recipe_nutrition_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.legacy_recipe_score_v1(text),evidence_private.legacy_recipe_nutrition_v1(text) TO service_role;
CREATE OR REPLACE FUNCTION public.api_get_recipe_score(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('error','Recipe aggregate retired','status','retired','reason','unsupported_aggregate');
$$;
CREATE OR REPLACE FUNCTION public.api_get_recipe_nutrition(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('error','Recipe nutrition estimate withheld','status','retired','reason','incompatible_amounts_and_basis');
$$;
REVOKE ALL ON FUNCTION public.api_get_recipe_score(text),public.api_get_recipe_nutrition(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_recipe_score(text),public.api_get_recipe_nutrition(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.increment_achievement_progress(p_achievement_slug text,p_increment integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid:=auth.uid(); v_def public.achievement_def%ROWTYPE; v_progress integer; v_new boolean:=false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_achievement_slug IN ('first_low_score','low_score_10','all_health') THEN
    RETURN jsonb_build_object('error','Score-based milestone retired','status','retired');
  END IF;
  IF p_increment IS NULL OR p_increment<1 THEN RETURN jsonb_build_object('error','Increment must be positive'); END IF;
  SELECT * INTO v_def FROM public.achievement_def WHERE slug=p_achievement_slug AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Achievement not found'); END IF;
  INSERT INTO public.user_achievement(user_id,achievement_id,progress) VALUES(v_user,v_def.id,p_increment)
  ON CONFLICT(user_id,achievement_id) DO UPDATE SET progress=public.user_achievement.progress+p_increment RETURNING progress INTO v_progress;
  IF v_progress>=v_def.threshold THEN
    UPDATE public.user_achievement SET unlocked_at=COALESCE(unlocked_at,now())
    WHERE user_id=v_user AND achievement_id=v_def.id AND unlocked_at IS NULL;
    v_new:=FOUND;
  END IF;
  RETURN jsonb_build_object('slug',p_achievement_slug,'progress',v_progress,'threshold',v_def.threshold,
    'unlocked',v_progress>=v_def.threshold,'newly_unlocked',v_new);
END $$;
REVOKE ALL ON FUNCTION public.increment_achievement_progress(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.increment_achievement_progress(text,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.api_get_achievements()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rows jsonb; v_retired jsonb; v_total integer; v_unlocked integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',d.id,'slug',d.slug,
    'category',CASE WHEN d.category='health' THEN 'exploration' ELSE d.category END,
    'title_key',CASE WHEN d.slug='allergen_filter' THEN 'evidenceActivity.allergenFilterTitle' ELSE d.title_key END,
    'desc_key',CASE WHEN d.slug='allergen_filter' THEN 'evidenceActivity.allergenFilterDescription' ELSE d.desc_key END,
    'icon',d.icon,'threshold',d.threshold,'country',d.country,'sort_order',d.sort_order,
    'progress',COALESCE(u.progress,0),'unlocked_at',u.unlocked_at) ORDER BY d.category,d.sort_order),'[]'::jsonb),
    count(*)::integer,count(u.unlocked_at)::integer INTO v_rows,v_total,v_unlocked
  FROM public.achievement_def d LEFT JOIN public.user_achievement u ON u.achievement_id=d.id AND u.user_id=auth.uid()
  WHERE d.is_active AND d.slug NOT IN ('first_low_score','low_score_10','all_health');
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',d.id,'slug',d.slug,'progress',u.progress,
    'unlocked_at',u.unlocked_at,'status','retired') ORDER BY d.sort_order),'[]'::jsonb) INTO v_retired
  FROM public.achievement_def d JOIN public.user_achievement u ON u.achievement_id=d.id AND u.user_id=auth.uid()
  WHERE d.slug IN ('first_low_score','low_score_10','all_health');
  RETURN jsonb_build_object('achievements',v_rows,'total',v_total,'unlocked',v_unlocked,'retired_achievements',v_retired);
END $$;
REVOKE ALL ON FUNCTION public.api_get_achievements() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_achievements() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.browse_recipes(p_category text DEFAULT NULL,p_country text DEFAULT NULL,p_tag text DEFAULT NULL,p_difficulty text DEFAULT NULL,p_max_time integer DEFAULT NULL,p_limit integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,slug text,title_key text,description_key text,category text,difficulty text,prep_time_min integer,cook_time_min integer,servings integer,image_url text,country text,tags text[],total_time integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_tag IS NOT NULL OR p_max_time IS NOT NULL THEN RAISE EXCEPTION 'Recipe tag and total-time filters are retired' USING ERRCODE='22023'; END IF;
  RETURN QUERY SELECT r.id,r.slug,r.title_key,r.description_key,r.category,r.difficulty,r.prep_time_min,r.cook_time_min,
    r.servings,r.image_url,r.country,ARRAY[]::text[],r.prep_time_min+r.cook_time_min
  FROM public.recipe r WHERE r.is_published
    AND (p_category IS NULL OR r.category=p_category) AND (p_country IS NULL OR r.country IS NULL OR r.country=p_country)
    AND (p_difficulty IS NULL OR r.difficulty=p_difficulty)
  ORDER BY r.created_at DESC,r.id LIMIT least(greatest(COALESCE(p_limit,20),1),100) OFFSET greatest(COALESCE(p_offset,0),0);
END $$;
REVOKE ALL ON FUNCTION public.browse_recipes(text,text,text,text,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.browse_recipes(text,text,text,text,integer,integer,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.api_get_recipes(p_country text DEFAULT NULL,p_category text DEFAULT NULL,p_tag text DEFAULT NULL,p_difficulty text DEFAULT NULL,p_max_time integer DEFAULT NULL,p_limit integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_tag IS NOT NULL OR p_max_time IS NOT NULL THEN RETURN jsonb_build_object('error','Recipe tag and total-time filters are retired'); END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(r)||jsonb_build_object('total_time_min',r.total_time)),'[]'::jsonb) INTO v_rows
  FROM public.browse_recipes(p_category,p_country,NULL,p_difficulty,NULL,p_limit,p_offset) r;
  SELECT count(*)::integer INTO v_total FROM public.recipe r WHERE r.is_published
    AND (p_country IS NULL OR r.country IS NULL OR r.country=p_country) AND (p_category IS NULL OR r.category=p_category)
    AND (p_difficulty IS NULL OR r.difficulty=p_difficulty);
  RETURN jsonb_build_object('recipes',v_rows,'total_count',v_total,'limit',least(greatest(COALESCE(p_limit,20),1),100),'offset',greatest(COALESCE(p_offset,0),0));
END $$;
REVOKE ALL ON FUNCTION public.api_get_recipes(text,text,text,text,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_recipes(text,text,text,text,integer,integer,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_recipe_detail(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_recipe public.recipe%ROWTYPE; v_steps jsonb; v_ingredients jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  SELECT * INTO v_recipe FROM public.recipe WHERE slug=p_slug AND is_published;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('step_number',s.step_number,'content_key',s.content_key) ORDER BY s.step_number),'[]'::jsonb)
    INTO v_steps FROM public.recipe_step s WHERE s.recipe_id=v_recipe.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'name_key',i.name_key,'optional',i.optional,'ingredient_ref_id',i.ingredient_ref_id,
    'linked_products',COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id',p.product_id,'product_name',p.product_name,'brand',p.brand,
      'unhealthiness_score',NULL,'image_url',NULL,'is_primary',false,'match_confidence',NULL) ORDER BY p.product_name,p.product_id)
      FROM public.recipe_ingredient_product x JOIN public.products p ON p.product_id=x.product_id
      WHERE x.recipe_ingredient_id=i.id AND p.is_deprecated IS NOT TRUE),'[]'::jsonb)) ORDER BY i.sort_order,i.id),'[]'::jsonb)
    INTO v_ingredients FROM public.recipe_ingredient i WHERE i.recipe_id=v_recipe.id;
  RETURN jsonb_build_object('id',v_recipe.id,'slug',v_recipe.slug,'title_key',v_recipe.title_key,'description_key',v_recipe.description_key,
    'category',v_recipe.category,'difficulty',v_recipe.difficulty,'prep_time_min',v_recipe.prep_time_min,'cook_time_min',v_recipe.cook_time_min,
    'servings',v_recipe.servings,'image_url',v_recipe.image_url,'country',v_recipe.country,'tags','[]'::jsonb,'steps',v_steps,'ingredients',v_ingredients);
END $$;
REVOKE ALL ON FUNCTION public.get_recipe_detail(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_recipe_detail(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_get_recipe_detail(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  v:=public.get_recipe_detail(p_slug);
  IF v IS NULL THEN RETURN jsonb_build_object('error','Recipe not found'); END IF;
  IF v ? 'error' THEN RETURN v; END IF;
  RETURN jsonb_build_object('recipe',v-'ingredients'-'steps','ingredients',v->'ingredients','steps',v->'steps',
    'ingredient_count',jsonb_array_length(v->'ingredients'),'step_count',jsonb_array_length(v->'steps'));
END $$;
REVOKE ALL ON FUNCTION public.api_get_recipe_detail(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_recipe_detail(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.find_products_for_recipe_ingredient(p_recipe_ingredient_id uuid,p_country text DEFAULT NULL,p_limit integer DEFAULT 10)
RETURNS TABLE(product_id bigint,product_name text,brand text,ean text,unhealthiness_score numeric,image_url text,is_linked boolean,is_primary boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.product_id,p.product_name,p.brand,p.ean,NULL::numeric,NULL::text,true,false
  FROM public.recipe_ingredient_product x JOIN public.products p ON p.product_id=x.product_id
  JOIN public.recipe_ingredient i ON i.id=x.recipe_ingredient_id JOIN public.recipe r ON r.id=i.recipe_id
  WHERE i.id=p_recipe_ingredient_id AND r.is_published AND p.is_deprecated IS NOT TRUE AND (p_country IS NULL OR p.country=p_country)
  ORDER BY p.product_name,p.product_id LIMIT least(greatest(COALESCE(p_limit,10),1),100);
END $$;
REVOKE ALL ON FUNCTION public.find_products_for_recipe_ingredient(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.find_products_for_recipe_ingredient(uuid,text,integer) TO authenticated,service_role;
-- Ingredient risk profiles and score-ranked co-occurrences are not a current
-- evidence model. Preserve the registry/history; require clients to refresh.
CREATE OR REPLACE FUNCTION public.api_get_ingredient_profile(p_ingredient_id bigint,p_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('error','Ingredient interpretation retired','status','refresh_required','reason','unsupported_risk_profile');
$$;
REVOKE ALL ON FUNCTION public.api_get_ingredient_profile(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_ingredient_profile(bigint,text) TO authenticated,service_role;
COMMIT;
