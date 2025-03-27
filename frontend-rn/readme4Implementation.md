# Development Tasks

## Stripe Integration
-  Clean up Stripe backend implementation
-  Clean up Stripe frontend and add safe areas
-  Configure payment information display (consider storing last 4 card digits)
-  Add subscription products:
  -  Monthly subscription
  -  6-month subscription
  -  Annual subscription (with discount)
-  Create profile component for subscription management
-  Implement success page after subscription
-  Add email confirmation for subscriptions
-  Implement automatic subscription renewal

## OpenAI Integration
-  Clean up OpenAI backend implementation
-  Clean up OpenAI frontend implementation
-  Fix conversation renaming functionality
-  Implement free trial (6 prompts), then require Stripe payment

## AI Features
-  Fine-tune the model for Motivational Interviewing
  -  Test with GPT-3.5
  -  Test with GPT-4.0
  -  Implement notification system based on chat history
  -  Review Motivational Interviewing template
-  Add voice mode functionality

## General
-  Test all features end-to-end
-  Perform security review
-  Optimize performance

prompt manus

this is my project so far, familiarize with it https://github.com/rameshiCode/aindependent/tree/feature/chat-integration-clean.
im using expo. also the stuff i want to develop are kinda ready, i would possibly add a voice mode or something.

i want to clean my code a bit, i will give you a readme that i made
# Development Tasks

## Stripe Integration
-  Clean up Stripe backend implementation
-  Clean up Stripe frontend and add safe areas
-  Configure payment information display (consider storing last 4 card digits)
-  Add subscription products:
  -  Monthly subscription
  -  6-month subscription
  -  Annual subscription (with discount)
-  Create profile component for subscription management
-  Implement success page after subscription
-  Add email confirmation for subscriptions
-  Implement automatic subscription renewal

## OpenAI Integration
-  Clean up OpenAI backend implementation
-  Clean up OpenAI frontend implementation
-  Fix conversation renaming functionality
-  Implement free trial (6 prompts), then require Stripe payment

## AI Features
-  Fine-tune the model for Motivational Interviewing
  -  Test with GPT-3.5
  -  Test with GPT-4.0
  -  Implement notification system based on chat history
  -  Review Motivational Interviewing template
-  Add voice mode functionality

## General
-  Test all features end-to-end
-  Perform security review
-  Optimize performance


for now lets focus on stripe. for stripe i want to add something in the profile.tsx a page where user can manage the subscription see active subscription.

first understand the project from github repo.
