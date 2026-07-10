UPDATE `storage_configs`
SET `cdn_auth_token` = NULL
WHERE `provider` = 'upyun_uss' AND `cdn_auth_token` = 'yvAAxOQXup34nX';
