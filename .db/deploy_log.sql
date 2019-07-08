CREATE DATABASE IF NOT EXISTS `deploy`;

USE `deploy`;

CREATE TABLE IF NOT EXISTS `deploy_log` (
`id` int(1) UNSIGNED NOT NULL AUTO_INCREMENT,
`action` text CHARACTER SET utf8 COLLATE utf8_general_ci NULL,
`environment` text CHARACTER SET utf8 COLLATE utf8_general_ci NULL,
`user` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
`message` text CHARACTER SET utf8 COLLATE utf8_general_ci NULL,
`debugInfo` text CHARACTER SET utf8 COLLATE utf8_general_ci NULL,
`jiraTicketId` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
`status` enum('IN_PROGRESS','SUCCESS','ERROR','ABORT') CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
`startAt` datetime(0) NULL DEFAULT NULL,
`endAt` datetime(0) NULL DEFAULT NULL,
PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET=utf8 COLLATE=utf8_general_ci ROW_FORMAT=Dynamic;


## Change DB_USER_NAME && DB_USER_PASS with proper values
GRANT ALL PRIVILEGES ON deploy.deploy_log TO '{{DB_USER_NAME}}'@'%' IDENTIFIED BY '{{DB_USER_PASS}}';
FLUSH PRIVILEGES;
