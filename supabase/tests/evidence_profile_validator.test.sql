-- Synthetic configurations and all updates are rolled back.
BEGIN;
SELECT no_plan();
SELECT ok((public.validate_country_profile('v3.2','PL')->>'valid')::boolean, 'legacy v3.2 omitted continuous types remain valid');
SELECT ok((public.validate_country_profile('v3.3','PL')->>'valid')::boolean, 'v3.3 penalties plus negative bonus are valid');
SELECT is((public.validate_country_profile('v3.3','PL')->>'total_weight')::numeric, 0.92::numeric, 'total_weight retains signed sum semantics');
SELECT is((public.validate_country_profile('v3.3','PL')->>'penalty_weight')::numeric, 1.0::numeric, 'penalty weights total one');
SELECT is((public.validate_country_profile('v3.3','PL')->>'bonus_weight')::numeric, (-0.08)::numeric, 'bonus is reported separately');
SELECT ok(NOT (public.validate_country_profile('qa-missing-version','PL')->>'valid')::boolean, 'unknown version fails');
SELECT ok(NOT has_function_privilege('anon','public.validate_country_profile(text,text)','EXECUTE'), 'anonymous cannot invoke admin validator');
SELECT ok(NOT has_function_privilege('authenticated','public.validate_country_profile(text,text)','EXECUTE'), 'authenticated cannot invoke admin validator');

CREATE TEMP TABLE validator_cases(label text, config jsonb);
INSERT INTO validator_cases VALUES
('missing name', '{"factors":[{"type":"continuous","weight":1}]}'),
('null name', '{"factors":[{"name":null,"type":"continuous","weight":1}]}'),
('empty name', '{"factors":[{"name":"","type":"continuous","weight":1}]}'),
('whitespace name', '{"factors":[{"name":"  ","type":"continuous","weight":1}]}'),
('nonstring name', '{"factors":[{"name":1,"type":"continuous","weight":1}]}'),
('duplicate name', '{"factors":[{"name":"p","type":"continuous","weight":0.5},{"name":"p","type":"continuous","weight":0.5}]}'),
('positive bonus', '{"factors":[{"name":"p","type":"continuous","weight":1},{"name":"b","type":"bonus","weight":0.08}]}'),
('zero bonus', '{"factors":[{"name":"p","type":"continuous","weight":1},{"name":"b","type":"bonus","weight":0}]}'),
('negative penalty', '{"factors":[{"name":"p","type":"continuous","weight":-0.1},{"name":"c","type":"categorical","weight":1.1}]}'),
('zero penalty', '{"factors":[{"name":"p","type":"continuous","weight":0},{"name":"c","type":"categorical","weight":1}]}'),
('incorrect penalty sum', '{"factors":[{"name":"p","type":"continuous","weight":0.92}]}'),
('unknown type', '{"factors":[{"name":"p","type":"unexpected","weight":1}]}'),
('missing type', '{"factors":[{"name":"p","weight":1}]}'),
('null type', '{"factors":[{"name":"p","type":null,"weight":1}]}'),
('missing weight', '{"factors":[{"name":"p","type":"continuous"}]}'),
('null weight', '{"factors":[{"name":"p","type":"continuous","weight":null}]}'),
('string weight', '{"factors":[{"name":"p","type":"continuous","weight":"1"}]}'),
('NaN weight', '{"factors":[{"name":"p","type":"continuous","weight":"NaN"}]}'),
('infinite weight', '{"factors":[{"name":"p","type":"continuous","weight":"Infinity"}]}'),
('negative infinite weight', '{"factors":[{"name":"p","type":"continuous","weight":"-Infinity"}]}'),
('zero ceiling', '{"factors":[{"name":"p","type":"continuous","weight":1,"ceiling":0}]}'),
('NaN ceiling', '{"factors":[{"name":"p","type":"continuous","weight":1,"ceiling":"NaN"}]}'),
('null ceiling', '{"factors":[{"name":"p","type":"continuous","weight":1,"ceiling":null}]}'),
('missing factors', '{}'),
('null factors', '{"factors":null}'),
('object factors', '{"factors":{}}'),
('empty factors', '{"factors":[]}'),
('scalar factor', '{"factors":[1]}');
INSERT INTO public.scoring_model_versions(version, status, config)
SELECT 'qa-validator-' || label, 'draft', config FROM validator_cases;
SELECT ok(NOT (public.validate_country_profile('qa-validator-' || label,'PL')->>'valid')::boolean, label || ' fails closed')
FROM validator_cases ORDER BY label;

INSERT INTO public.scoring_model_versions(version,status,config,country_overrides)
VALUES ('qa-validator-override','draft','{"factors":[{"name":"p","type":"continuous","weight":1}]}',
'{"DE":{"factors":[{"name":"p","type":"continuous","weight":0.5}]}}');
SELECT ok((public.validate_country_profile('qa-validator-override','PL')->>'valid')::boolean, 'explicit continuous penalty is accepted');
SELECT ok(NOT (public.validate_country_profile('qa-validator-override','DE')->>'valid')::boolean, 'country replacement config is validated');
UPDATE public.scoring_model_versions SET config=jsonb_set(config,'{factors,0,type}','null') WHERE version='v3.2';
SELECT ok(NOT (public.validate_country_profile('v3.2','PL')->>'valid')::boolean, 'legacy explicit null type is rejected');
SELECT * FROM finish();
ROLLBACK;
