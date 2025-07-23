#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LiveflowStack } from './stacks/liveflow-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

new LiveflowStack(app, `LiveflowStack-${environment}`, {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] || 'us-east-1',
  },
  tags: {
    Project: 'Liveflow',
    Environment: environment,
  },
});
