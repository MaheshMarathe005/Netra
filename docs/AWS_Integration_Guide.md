# AWS Integration Guide

## Overview
This guide provides the instructions to deploy the serverless infrastructure required for the NETRA sync pipeline. It provisions the S3 bucket, Lambda function, and API Gateway.

## Prerequisites
- Node.js and NPM installed.
- Serverless Framework installed globally (`npm install -g serverless`).
- AWS CLI configured with your credentials (`aws configure`).

## Deployment Steps

1. Navigate to the `aws` directory:
   ```bash
   cd aws
   ```

2. Deploy the stack:
   ```bash
   serverless deploy
   ```

3. After deployment, the Serverless CLI will output the API Gateway URL. It will look something like:
   ```
   endpoints:
     POST - https://xyz123.execute-api.ap-south-1.amazonaws.com/dev/sync
   ```

4. Copy this URL and update the `API_ENDPOINT` constant in `src/services/SyncService.ts`.

## Infrastructure Details
- **S3 Bucket:** `attendance-records-netra` (AES256 Server-Side Encryption enabled).
- **Lambda Function:** Validates the JSON payload and writes individual records as JSON files to the S3 bucket organized by `deviceId` and `date`.
- **API Gateway:** Exposes the Lambda function securely.

## Teardown
To remove all AWS resources created for this project:
```bash
serverless remove
```
