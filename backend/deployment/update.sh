#!/bin/bash

aws cloudformation update-stack \
    --stack-name ownstats-47110815-backend \
    --template-body file://../.serverless/cloudformation-template-update-stack-json \
    --capabilities CAPABILITY_NAMED_IAM