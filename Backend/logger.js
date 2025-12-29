// logger.js
import { createLogger, format, transports } from "winston";
const { combine, timestamp, printf, colorize, errors } = format;
import chalk from "chalk";
import PostgresTransport from './postgres-transport.js';

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    const endpoint = metadata.endpoint;
    const sourceIP = metadata.sourceIP;
    const method = metadata.method;
    const logMessage = stack || message;
    const phoneNumber = metadata.phoneNumber;
    const moreInfo = metadata.moreInfo;
    const moreInfoStr = moreInfo && typeof moreInfo === 'object' ? JSON.stringify(moreInfo, null, 2) : moreInfo;

const parts = [
    chalk.gray(timestamp),
    chalk.blue(level),
    endpoint ? chalk.yellow(`Endpoint: ${endpoint}`) : '',
    method ? chalk.magenta(`Requested method: ${method}`) : '',
    chalk.white(logMessage),
    sourceIP ? chalk.cyan(`Request by ${sourceIP}`) : '',
    phoneNumber ? chalk.green(`PhoneNumber: ${phoneNumber}`) : '',
    moreInfoStr ? chalk.bold(`More info: ${moreInfoStr}`) : ''
].filter(part => part !== '');


    // const parts = [
    //     timestamp,
    //     level,
    //     endpoint ? `Endpoint: ${endpoint}` : '',
    //     method ? `Requested method : ${method}` :'',
    //     logMessage,
    //     sourceIP ? `Request by ${sourceIP}` : '',
    //     phoneNumber ? `PhoneNumber: ${phoneNumber}` : '',
        
    //     moreInfoStr? `More info : ${moreInfo}`:''
    // ].filter(part => part !== ''); // Remove empty strings


    return parts.join(' | ');
});

const logger = createLogger({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        logFormat
    ),
    transports: [
        new transports.Console({
            format: combine(colorize(), logFormat),
        }),
        new transports.File({ filename: "logs/error.log", level: "error" }),
        new transports.File({ filename: "logs/combined.log" }),
        new PostgresTransport({ level: 'info' }),
    ],
});

export default logger;