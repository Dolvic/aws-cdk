/// !cdk-integ PipelineSecurityStack
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import { App, SecretValue, Stack, StackProps, Stage, StageProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as cdkp from '../lib';

class MyStage extends Stage {

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack = new Stack(this, 'MyStack', {
      env: props?.env,
    });

    const topic = new sns.Topic(stack, 'Topic');

    topic.grantPublish(new iam.AccountPrincipal(this.account));
  }
}


class MySafeStage extends Stage {

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack = new Stack(this, 'MySafeStack', {
      env: props?.env,
    });

    new sns.Topic(stack, 'MySafeTopic');
  }
}

export class TestCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');

    const pipeline = new cdkp.CdkPipeline(this, 'TestPipeline', {
      selfMutating: false,
      pipelineName: 'TestPipeline',
      cloudAssemblyArtifact,
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: SecretValue.secretsManager('github-token'),
        owner: 'BryanPan342',
        repo: 'test-cdk',
        branch: 'main',
      }),
      synthAction: cdkp.SimpleSynthAction.standardYarnSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        buildCommand: 'yarn build',
      }),
    });

    pipeline.addApplicationStage(new MyStage(this, 'SingleStage', {
      env: { account: this.account, region: this.region },
    }), { securityCheck: true });

    const stage1 = pipeline.addApplicationStage(new MyStage(this, 'PreProduction', {
      env: { account: this.account, region: this.region },
    }), { securityCheck: true });

    stage1.addApplication(new MySafeStage(this, 'SafeProduction', {
      env: { account: this.account, region: this.region },
    }));

    stage1.addApplication(new MySafeStage(this, 'DisableSecurityCheck', {
      env: { account: this.account, region: this.region },
    }), { securityCheck: false });

    const stage2 = pipeline.addApplicationStage(new MyStage(this, 'NoSecurityCheck', {
      env: { account: this.account, region: this.region },
    }));

    stage2.addApplication(new MyStage(this, 'EnableSecurityCheck', {
      env: { account: this.account, region: this.region },
    }), { securityCheck: true });
  }
}

const app = new App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': 'true',
  },
});
new TestCdkStack(app, 'PipelineSecurityStack', {
  env: { account: '045046196850', region: 'us-west-2' },
});
app.synth();
