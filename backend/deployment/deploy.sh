#!/bin/bash

# 1. Create the IAM policy for deployment
aws iam create-policy \
    --policy-name ownstats-deployment-policy \
    --policy-document file://policy.json

# 2. Create an IAM role and attach the policy (if needed)
aws iam create-role \
    --role-name ownstats-deployment-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"cloudformation.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy \
    --role-name ownstats-deployment-role \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/ownstats-deployment-policy

# 3. Deploy the CloudFormation stack
aws cloudformation create-stack \
    --stack-name ownstats-47110815-backend \
    --template-body file://../.serverless/cloudformation-template-update-stack-json \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameters \
        ParameterKey=Stage,ParameterValue=prd

# 4. Monitor the stack creation
aws cloudformation describe-stack-events \
    --stack-name ownstats-47110815-backend

# 5. Check stack status
aws cloudformation describe-stacks \
    --stack-name ownstats-47110815-backend \
    --query 'Stacks[0].StackStatus'
