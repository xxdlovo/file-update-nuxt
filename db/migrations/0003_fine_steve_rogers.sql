ALTER TABLE `storage_configs` ADD `cdn_auth_token` text;
UPDATE `storage_configs`
SET `cdn_auth_token` = 'yvAAxOQXup34nX'
WHERE `provider` = 'upyun_uss' AND (`cdn_auth_token` IS NULL OR `cdn_auth_token` = '');
