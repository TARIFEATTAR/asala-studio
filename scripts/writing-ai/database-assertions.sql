\set ON_ERROR_STOP on
set role service_role;
set request.jwt.claims = '{"role":"service_role"}';
select public.save_writing_ai_settings('11111111-1111-4111-8111-111111111111','openai','gpt-5-mini','custom','offline-first-test-key');
select public.save_writing_ai_settings('22222222-2222-4222-8222-222222222222','openai','gpt-5-mini','custom','offline-second-test-key');
do $$begin
 if public.read_writing_ai_key('11111111-1111-4111-8111-111111111111','openai') <> 'offline-first-test-key' then raise exception 'wrong org key'; end if;
 if public.read_writing_ai_key('11111111-1111-4111-8111-111111111111','gemini') is not null then raise exception 'provider key crossed'; end if;
end$$;
select public.save_writing_ai_settings('11111111-1111-4111-8111-111111111111','openai','gpt-4.1-mini','custom','offline-rotated-test-key');
select public.save_writing_ai_settings('11111111-1111-4111-8111-111111111111','openai','gpt-5-mini','custom',null);
do $$begin
 if public.read_writing_ai_key('11111111-1111-4111-8111-111111111111','openai') <> 'offline-rotated-test-key' then raise exception 'key rotation or preservation failed'; end if;
 begin
  perform public.save_writing_ai_settings('11111111-1111-4111-8111-111111111111','openrouter','openai/gpt-5','managed',null);
  raise exception 'paid openrouter accepted';
 exception when check_violation then null;
 end;
end$$;
reset role;
do $$begin
 if (select count(*) from writing_ai_private.writing_ai_keys) <> 2 then raise exception 'duplicate key records'; end if;
 if exists(select 1 from writing_ai_private.writing_ai_keys k join vault.secrets s on s.id=k.secret_id where s.secret in ('offline-first-test-key','offline-second-test-key','offline-rotated-test-key')) then raise exception 'key stored as plaintext'; end if;
end$$;
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
do $$begin
 if (select count(*) from public.writing_ai_settings) <> 1 then raise exception 'RLS leaked another org'; end if;
 begin
  perform public.read_writing_ai_key('11111111-1111-4111-8111-111111111111','openai');
  raise exception 'authenticated read key';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_writing_ai_settings('11111111-1111-4111-8111-111111111111','openai','gpt-5-mini','managed',null);
  raise exception 'authenticated bypassed edge permission check';
 exception when insufficient_privilege then null; end;
 begin
  perform secret_id from writing_ai_private.writing_ai_keys;
  raise exception 'private key refs exposed';
 exception when insufficient_privilege then null; end;
 begin
  update public.writing_ai_settings set model='gpt-4.1-mini';
  raise exception 'direct settings write allowed';
 exception when insufficient_privilege then null; end;
end$$;
set request.jwt.claims = '{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';
do $$begin
 if (select count(*) from public.writing_ai_settings) <> 0 then raise exception 'nonmember read settings'; end if;
end$$;
reset role;
select 'PASS: Vault encryption, rotation, key preservation, provider isolation, RLS and RPC privileges' as result;
