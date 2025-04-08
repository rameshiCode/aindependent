// This file is auto-generated by @hey-api/openapi-ts

import {
  type Options as ClientOptions,
  type TDataShape,
  type Client,
  urlSearchParamsBodySerializer,
} from "@hey-api/client-fetch"
import type {
  LoginAuthGoogleData,
  LoginAuthGoogleResponse,
  LoginAuthGoogleError,
  LoginAuthGoogle1Data,
  LoginAuthGoogle1Error,
  LoginLoginForAccessTokenData,
  LoginLoginForAccessTokenResponse,
  LoginLoginForAccessTokenError,
  LoginTestTokenData,
  LoginTestTokenResponse,
  LoginRecoverPasswordData,
  LoginRecoverPasswordResponse,
  LoginRecoverPasswordError,
  LoginResetPasswordData,
  LoginResetPasswordResponse,
  LoginResetPasswordError,
  LoginRecoverPasswordHtmlContentData,
  LoginRecoverPasswordHtmlContentResponse,
  LoginRecoverPasswordHtmlContentError,
  UsersReadUsersData,
  UsersReadUsersResponse,
  UsersReadUsersError,
  UsersCreateUserData,
  UsersCreateUserResponse,
  UsersCreateUserError,
  UsersDeleteUserMeData,
  UsersDeleteUserMeResponse,
  UsersReadUserMeData,
  UsersReadUserMeResponse,
  UsersUpdateUserMeData,
  UsersUpdateUserMeResponse,
  UsersUpdateUserMeError,
  UsersUpdatePasswordMeData,
  UsersUpdatePasswordMeResponse,
  UsersUpdatePasswordMeError,
  UsersRegisterUserData,
  UsersRegisterUserResponse,
  UsersRegisterUserError,
  UsersDeleteUserData,
  UsersDeleteUserResponse,
  UsersDeleteUserError,
  UsersReadUserByIdData,
  UsersReadUserByIdResponse,
  UsersReadUserByIdError,
  UsersUpdateUserData,
  UsersUpdateUserResponse,
  UsersUpdateUserError,
  UtilsTestEmailData,
  UtilsTestEmailResponse,
  UtilsTestEmailError,
  UtilsHealthCheckData,
  UtilsHealthCheckResponse,
  StripeStripeWebhookData,
  StripeStripeWebhookResponse,
  StripeStripeWebhookError,
  StripeStripeHealthCheckData,
  StripeGetSubscriptionStatusData,
  StripeGetSubscriptionStatusResponse,
  StripeCreateCheckoutSessionData,
  StripeCreateCheckoutSessionResponse,
  StripeCreateCheckoutSessionError,
  StripeGetUsageStatusData,
  StripeGetUsageStatusResponse,
  StripeIncrementUsageData,
  StripeIncrementUsageResponse,
  StripeGetAllSubscriptionsData,
  StripeGetAllSubscriptionsResponse,
  StripeGetAllSubscriptionsError,
  StripeCreateSubscriptionWithPaymentMethodData,
  StripeCreateSubscriptionWithPaymentMethodResponse,
  StripeCreateSubscriptionWithPaymentMethodError,
  StripeCancelSubscriptionData,
  StripeCancelSubscriptionResponse,
  StripeCancelSubscriptionError,
  StripeListPaymentMethodsData,
  StripeListPaymentMethodsResponse,
  StripeGetProductsData,
  StripeGetProductsResponse,
  StripeGetProductPricesData,
  StripeGetProductPricesResponse,
  StripeGetProductPricesError,
  StripeCreatePortalSessionData,
  StripeCreatePortalSessionResponse,
  StripeCreatePortalSessionError,
  StripeCreatePaymentIntentData,
  StripeCreatePaymentIntentResponse,
  StripeCreatePaymentIntentError,
  StripeConfirmSubscriptionData,
  StripeConfirmSubscriptionResponse,
  StripeConfirmSubscriptionError,
  StripeGetSubscriptionDetailsData,
  StripeGetSubscriptionDetailsResponse,
  StripeGetAvailableSubscriptionsData,
  StripeGetAvailableSubscriptionsResponse,
  OpenaiGetConversationsData,
  OpenaiGetConversationsResponse,
  OpenaiCreateConversationData,
  OpenaiCreateConversationResponse,
  OpenaiCreateConversationError,
  OpenaiDeleteConversationData,
  OpenaiDeleteConversationResponse,
  OpenaiDeleteConversationError,
  OpenaiGetConversationData,
  OpenaiGetConversationResponse,
  OpenaiGetConversationError,
  OpenaiUpdateConversationData,
  OpenaiUpdateConversationResponse,
  OpenaiUpdateConversationError,
  OpenaiCreateMessageData,
  OpenaiCreateMessageResponse,
  OpenaiCreateMessageError,
  ProfilesGetMyProfileData,
  ProfilesGetMyProfileResponse,
  ProfilesUpdateAbstinenceStatusData,
  ProfilesUpdateAbstinenceStatusResponse,
  ProfilesUpdateAbstinenceStatusError,
  ProfilesGetUserGoalsData,
  ProfilesGetUserGoalsResponse,
  ProfilesGetUserGoalsError,
  ProfilesCreateUserGoalData,
  ProfilesCreateUserGoalResponse,
  ProfilesCreateUserGoalError,
  ProfilesUpdateUserGoalData,
  ProfilesUpdateUserGoalResponse,
  ProfilesUpdateUserGoalError,
  ProfilesGetUserInsightsData,
  ProfilesGetUserInsightsResponse,
  ProfilesGetUserInsightsError,
  ProfilesGetProfileAttributeData,
  ProfilesGetProfileAttributeResponse,
  ProfilesGetProfileAttributeError,
  ProfilesUpdateProfileAttributeData,
  ProfilesUpdateProfileAttributeResponse,
  ProfilesUpdateProfileAttributeError,
  ProfilesForceProfileExtractionData,
  ProfilesForceProfileExtractionError,
  ProfilesGenerateSampleProfileData,
  ProfilesProcessAllConversationsData,
  ApiChatData,
  ApiChatError,
  ApiEndChatData,
  ApiEndChatError,
  NotificationsGetUserNotificationsData,
  NotificationsGetUserNotificationsResponse,
  NotificationsGetUserNotificationsError,
  NotificationsMarkNotificationOpenedData,
  NotificationsMarkNotificationOpenedError,
  NotificationsGenerateNotificationsData,
  NotificationsGenerateNotificationsResponse,
} from "./types.gen"
import { client as _heyApiClient } from "./client.gen"

export type Options<
  TData extends TDataShape = TDataShape,
  ThrowOnError extends boolean = boolean,
> = ClientOptions<TData, ThrowOnError> & {
  /**
   * You can provide a client instance returned by `createClient()` instead of
   * individual options. This might be also useful if you want to implement a
   * custom client.
   */
  client?: Client
  /**
   * You can pass arbitrary values through the `meta` object. This can be
   * used to access values that aren't defined as part of the SDK function.
   */
  meta?: Record<string, unknown>
}

export class LoginService {
  /**
   * Auth Google
   * Receives the Google auth 'code' plus the PKCE 'codeVerifier' from the Expo app.
   * Exchanges them for Google tokens. Fetches or creates a local user. Returns our own JWT.
   */
  public static authGoogle<ThrowOnError extends boolean = false>(
    options: Options<LoginAuthGoogleData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      LoginAuthGoogleResponse,
      LoginAuthGoogleError,
      ThrowOnError
    >({
      url: "/api/v1/login/auth/google",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Auth Google1
   * Handle Google OAuth2 callback and issue a JWT token.
   */
  public static authGoogle1<ThrowOnError extends boolean = false>(
    options: Options<LoginAuthGoogle1Data, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).get<
      unknown,
      LoginAuthGoogle1Error,
      ThrowOnError
    >({
      url: "/api/v1/login/auth/google1",
      ...options,
    })
  }

  /**
   * Login For Access Token
   * OAuth2 compatible token login, get an access token for future requests
   */
  public static loginForAccessToken<ThrowOnError extends boolean = false>(
    options: Options<LoginLoginForAccessTokenData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      LoginLoginForAccessTokenResponse,
      LoginLoginForAccessTokenError,
      ThrowOnError
    >({
      ...urlSearchParamsBodySerializer,
      url: "/api/v1/login/access-token",
      ...options,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...options?.headers,
      },
    })
  }

  /**
   * Test Token
   * Test access token
   */
  public static testToken<ThrowOnError extends boolean = false>(
    options?: Options<LoginTestTokenData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).post<
      LoginTestTokenResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/login/test-token",
      ...options,
    })
  }

  /**
   * Recover Password
   * Password Recovery
   */
  public static recoverPassword<ThrowOnError extends boolean = false>(
    options: Options<LoginRecoverPasswordData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      LoginRecoverPasswordResponse,
      LoginRecoverPasswordError,
      ThrowOnError
    >({
      url: "/api/v1/password-recovery/{email}",
      ...options,
    })
  }

  /**
   * Reset Password
   * Reset password
   */
  public static resetPassword<ThrowOnError extends boolean = false>(
    options: Options<LoginResetPasswordData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      LoginResetPasswordResponse,
      LoginResetPasswordError,
      ThrowOnError
    >({
      url: "/api/v1/reset-password/",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Recover Password Html Content
   * HTML Content for Password Recovery
   */
  public static recoverPasswordHtmlContent<
    ThrowOnError extends boolean = false,
  >(options: Options<LoginRecoverPasswordHtmlContentData, ThrowOnError>) {
    return (options.client ?? _heyApiClient).post<
      LoginRecoverPasswordHtmlContentResponse,
      LoginRecoverPasswordHtmlContentError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/password-recovery-html-content/{email}",
      ...options,
    })
  }
}

export class UsersService {
  /**
   * Read Users
   * Retrieve users.
   */
  public static readUsers<ThrowOnError extends boolean = false>(
    options?: Options<UsersReadUsersData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      UsersReadUsersResponse,
      UsersReadUsersError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/",
      ...options,
    })
  }

  /**
   * Create User
   * Create new user.
   */
  public static createUser<ThrowOnError extends boolean = false>(
    options: Options<UsersCreateUserData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      UsersCreateUserResponse,
      UsersCreateUserError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Delete User Me
   * Delete own user.
   */
  public static deleteUserMe<ThrowOnError extends boolean = false>(
    options?: Options<UsersDeleteUserMeData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).delete<
      UsersDeleteUserMeResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/me",
      ...options,
    })
  }

  /**
   * Read User Me
   * Get current user.
   */
  public static readUserMe<ThrowOnError extends boolean = false>(
    options?: Options<UsersReadUserMeData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      UsersReadUserMeResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/me",
      ...options,
    })
  }

  /**
   * Update User Me
   * Update own user.
   */
  public static updateUserMe<ThrowOnError extends boolean = false>(
    options: Options<UsersUpdateUserMeData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).patch<
      UsersUpdateUserMeResponse,
      UsersUpdateUserMeError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/me",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Update Password Me
   * Update own password.
   */
  public static updatePasswordMe<ThrowOnError extends boolean = false>(
    options: Options<UsersUpdatePasswordMeData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).patch<
      UsersUpdatePasswordMeResponse,
      UsersUpdatePasswordMeError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/me/password",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Register User
   * Create new user without the need to be logged in.
   */
  public static registerUser<ThrowOnError extends boolean = false>(
    options: Options<UsersRegisterUserData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      UsersRegisterUserResponse,
      UsersRegisterUserError,
      ThrowOnError
    >({
      url: "/api/v1/users/signup",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Delete User
   * Delete a user.
   */
  public static deleteUser<ThrowOnError extends boolean = false>(
    options: Options<UsersDeleteUserData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).delete<
      UsersDeleteUserResponse,
      UsersDeleteUserError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/{user_id}",
      ...options,
    })
  }

  /**
   * Read User By Id
   * Get a specific user by id.
   */
  public static readUserById<ThrowOnError extends boolean = false>(
    options: Options<UsersReadUserByIdData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).get<
      UsersReadUserByIdResponse,
      UsersReadUserByIdError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/{user_id}",
      ...options,
    })
  }

  /**
   * Update User
   * Update a user.
   */
  public static updateUser<ThrowOnError extends boolean = false>(
    options: Options<UsersUpdateUserData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).patch<
      UsersUpdateUserResponse,
      UsersUpdateUserError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/users/{user_id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }
}

export class UtilsService {
  /**
   * Test Email
   * Test emails.
   */
  public static testEmail<ThrowOnError extends boolean = false>(
    options: Options<UtilsTestEmailData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      UtilsTestEmailResponse,
      UtilsTestEmailError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/utils/test-email/",
      ...options,
    })
  }

  /**
   * Health Check
   */
  public static healthCheck<ThrowOnError extends boolean = false>(
    options?: Options<UtilsHealthCheckData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      UtilsHealthCheckResponse,
      unknown,
      ThrowOnError
    >({
      url: "/api/v1/utils/health-check/",
      ...options,
    })
  }
}

export class StripeService {
  /**
   * Stripe Webhook
   * Process Stripe webhook events
   */
  public static stripeWebhook<ThrowOnError extends boolean = false>(
    options?: Options<StripeStripeWebhookData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).post<
      StripeStripeWebhookResponse,
      StripeStripeWebhookError,
      ThrowOnError
    >({
      url: "/api/v1/stripe/webhook",
      ...options,
    })
  }

  /**
   * Stripe Health Check
   * Simple health check to verify Stripe API connectivity.
   * This endpoint doesn't require authentication.
   */
  public static stripeHealthCheck<ThrowOnError extends boolean = false>(
    options?: Options<StripeStripeHealthCheckData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      unknown,
      unknown,
      ThrowOnError
    >({
      url: "/api/v1/stripe/health-check",
      ...options,
    })
  }

  /**
   * Get Subscription Status
   * Get the subscription status for the current user.
   * This is used to determine if a user has access to premium features.
   */
  public static getSubscriptionStatus<ThrowOnError extends boolean = false>(
    options?: Options<StripeGetSubscriptionStatusData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeGetSubscriptionStatusResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/subscription-status",
      ...options,
    })
  }

  /**
   * Create Checkout Session
   * Create a Stripe Checkout session for subscription purchase.
   */
  public static createCheckoutSession<ThrowOnError extends boolean = false>(
    options: Options<StripeCreateCheckoutSessionData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      StripeCreateCheckoutSessionResponse,
      StripeCreateCheckoutSessionError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/create-checkout-session",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Get Usage Status
   * Get the current usage status for the user.
   * This tracks how many free requests the user has used and how many remain.
   */
  public static getUsageStatus<ThrowOnError extends boolean = false>(
    options?: Options<StripeGetUsageStatusData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeGetUsageStatusResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/usage-status",
      ...options,
    })
  }

  /**
   * Increment Usage
   * Increment the usage counter for the current user.
   * Call this when a user makes a request to your chat API.
   */
  public static incrementUsage<ThrowOnError extends boolean = false>(
    options?: Options<StripeIncrementUsageData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).post<
      StripeIncrementUsageResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/increment-usage",
      ...options,
    })
  }

  /**
   * Get All Subscriptions
   * Get all subscriptions across all customers.
   * This is an admin endpoint and is restricted to superusers.
   */
  public static getAllSubscriptions<ThrowOnError extends boolean = false>(
    options?: Options<StripeGetAllSubscriptionsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeGetAllSubscriptionsResponse,
      StripeGetAllSubscriptionsError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/admin/subscriptions",
      ...options,
    })
  }

  /**
   * Create Subscription With Payment Method
   * Create a subscription with an existing payment method.
   */
  public static createSubscriptionWithPaymentMethod<
    ThrowOnError extends boolean = false,
  >(
    options: Options<
      StripeCreateSubscriptionWithPaymentMethodData,
      ThrowOnError
    >,
  ) {
    return (options.client ?? _heyApiClient).post<
      StripeCreateSubscriptionWithPaymentMethodResponse,
      StripeCreateSubscriptionWithPaymentMethodError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/create-subscription-with-payment-method",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Cancel Subscription
   * Cancel a subscription at the end of the current billing period.
   */
  public static cancelSubscription<ThrowOnError extends boolean = false>(
    options: Options<StripeCancelSubscriptionData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      StripeCancelSubscriptionResponse,
      StripeCancelSubscriptionError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/cancel-subscription/{subscription_id}",
      ...options,
    })
  }

  /**
   * List Payment Methods
   * Get all payment methods for the current user.
   */
  public static listPaymentMethods<ThrowOnError extends boolean = false>(
    options?: Options<StripeListPaymentMethodsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeListPaymentMethodsResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/payment-methods",
      ...options,
    })
  }

  /**
   * Get Products
   * Get all active products from Stripe
   */
  public static getProducts<ThrowOnError extends boolean = false>(
    options?: Options<StripeGetProductsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeGetProductsResponse,
      unknown,
      ThrowOnError
    >({
      url: "/api/v1/stripe/products",
      ...options,
    })
  }

  /**
   * Get Product Prices
   * Get all prices for a specific product
   */
  public static getProductPrices<ThrowOnError extends boolean = false>(
    options: Options<StripeGetProductPricesData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).get<
      StripeGetProductPricesResponse,
      StripeGetProductPricesError,
      ThrowOnError
    >({
      url: "/api/v1/stripe/products/{product_id}/prices",
      ...options,
    })
  }

  /**
   * Create Portal Session
   * Create a Stripe Customer Portal session for subscription management.
   *
   * This endpoint creates a portal session that redirects the customer to the Stripe-hosted customer portal.
   * After managing their subscription, the customer will be redirected to the return_url.
   */
  public static createPortalSession<ThrowOnError extends boolean = false>(
    options: Options<StripeCreatePortalSessionData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      StripeCreatePortalSessionResponse,
      StripeCreatePortalSessionError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/create-portal-session",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Create Payment Intent
   * Create a payment intent for subscription setup using Stripe PaymentSheet
   */
  public static createPaymentIntent<ThrowOnError extends boolean = false>(
    options: Options<StripeCreatePaymentIntentData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      StripeCreatePaymentIntentResponse,
      StripeCreatePaymentIntentError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/create-payment-intent",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Confirm Subscription
   * Confirm subscription creation after successful payment
   */
  public static confirmSubscription<ThrowOnError extends boolean = false>(
    options: Options<StripeConfirmSubscriptionData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      StripeConfirmSubscriptionResponse,
      StripeConfirmSubscriptionError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/confirm-subscription",
      ...options,
    })
  }

  /**
   * Get Subscription Details
   * Get detailed information about the user's active subscription.
   *
   * This endpoint provides comprehensive information about the subscription,
   * including status, billing period, and plan details.
   */
  public static getSubscriptionDetails<ThrowOnError extends boolean = false>(
    options?: Options<StripeGetSubscriptionDetailsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeGetSubscriptionDetailsResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/details",
      ...options,
    })
  }

  /**
   * Get Available Subscriptions
   * Get all available subscription options with formatted details for display.
   */
  public static getAvailableSubscriptions<ThrowOnError extends boolean = false>(
    options?: Options<StripeGetAvailableSubscriptionsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      StripeGetAvailableSubscriptionsResponse,
      unknown,
      ThrowOnError
    >({
      url: "/api/v1/stripe/available-subscriptions",
      ...options,
    })
  }
}

export class OpenaiService {
  /**
   * Get Conversations
   * Get all conversations for the current user
   */
  public static getConversations<ThrowOnError extends boolean = false>(
    options?: Options<OpenaiGetConversationsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      OpenaiGetConversationsResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/openai/conversations",
      ...options,
    })
  }

  /**
   * Create Conversation
   * Create a new conversation
   */
  public static createConversation<ThrowOnError extends boolean = false>(
    options: Options<OpenaiCreateConversationData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      OpenaiCreateConversationResponse,
      OpenaiCreateConversationError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/openai/conversations",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Delete Conversation
   * Delete a conversation and all its messages
   */
  public static deleteConversation<ThrowOnError extends boolean = false>(
    options: Options<OpenaiDeleteConversationData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).delete<
      OpenaiDeleteConversationResponse,
      OpenaiDeleteConversationError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/openai/conversations/{conversation_id}",
      ...options,
    })
  }

  /**
   * Get Conversation
   * Get a specific conversation with messages
   */
  public static getConversation<ThrowOnError extends boolean = false>(
    options: Options<OpenaiGetConversationData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).get<
      OpenaiGetConversationResponse,
      OpenaiGetConversationError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/openai/conversations/{conversation_id}",
      ...options,
    })
  }

  /**
   * Update Conversation
   * Update conversation title
   */
  public static updateConversation<ThrowOnError extends boolean = false>(
    options: Options<OpenaiUpdateConversationData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).put<
      OpenaiUpdateConversationResponse,
      OpenaiUpdateConversationError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/openai/conversations/{conversation_id}",
      ...options,
    })
  }

  /**
   * Create Message
   * Create a new message and get a response from OpenAI
   */
  public static createMessage<ThrowOnError extends boolean = false>(
    options: Options<OpenaiCreateMessageData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      OpenaiCreateMessageResponse,
      OpenaiCreateMessageError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/openai/conversations/{conversation_id}/messages",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }
}

export class ProfilesService {
  /**
   * Get My Profile
   * Get the current user's profile including insights summary
   */
  public static getMyProfile<ThrowOnError extends boolean = false>(
    options?: Options<ProfilesGetMyProfileData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      ProfilesGetMyProfileResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/my-profile",
      ...options,
    })
  }

  /**
   * Update Abstinence Status
   * Update the user's abstinence status
   */
  public static updateAbstinenceStatus<ThrowOnError extends boolean = false>(
    options: Options<ProfilesUpdateAbstinenceStatusData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      ProfilesUpdateAbstinenceStatusResponse,
      ProfilesUpdateAbstinenceStatusError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/update-abstinence",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Get User Goals
   * Get goals for the current user, optionally filtered by status
   */
  public static getUserGoals<ThrowOnError extends boolean = false>(
    options?: Options<ProfilesGetUserGoalsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      ProfilesGetUserGoalsResponse,
      ProfilesGetUserGoalsError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/goals",
      ...options,
    })
  }

  /**
   * Create User Goal
   * Create a new goal for the user
   */
  public static createUserGoal<ThrowOnError extends boolean = false>(
    options: Options<ProfilesCreateUserGoalData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      ProfilesCreateUserGoalResponse,
      ProfilesCreateUserGoalError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/goals",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Update User Goal
   * Update an existing goal
   */
  public static updateUserGoal<ThrowOnError extends boolean = false>(
    options: Options<ProfilesUpdateUserGoalData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).put<
      ProfilesUpdateUserGoalResponse,
      ProfilesUpdateUserGoalError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/goals/{goal_id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Get User Insights
   * Get insights for the current user, optionally filtered by type
   */
  public static getUserInsights<ThrowOnError extends boolean = false>(
    options?: Options<ProfilesGetUserInsightsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      ProfilesGetUserInsightsResponse,
      ProfilesGetUserInsightsError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/insights",
      ...options,
    })
  }

  /**
   * Get Profile Attribute
   * Get a specific profile attribute
   */
  public static getProfileAttribute<ThrowOnError extends boolean = false>(
    options: Options<ProfilesGetProfileAttributeData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).get<
      ProfilesGetProfileAttributeResponse,
      ProfilesGetProfileAttributeError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/profile-attribute/{attribute_name}",
      ...options,
    })
  }

  /**
   * Update Profile Attribute
   * Update a specific profile attribute
   */
  public static updateProfileAttribute<ThrowOnError extends boolean = false>(
    options: Options<ProfilesUpdateProfileAttributeData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).put<
      ProfilesUpdateProfileAttributeResponse,
      ProfilesUpdateProfileAttributeError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/profile-attribute/{attribute_name}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * Force Profile Extraction
   * Force profile extraction for a specific conversation
   */
  public static forceProfileExtraction<ThrowOnError extends boolean = false>(
    options: Options<ProfilesForceProfileExtractionData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      unknown,
      ProfilesForceProfileExtractionError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/force-profile-extraction/{conversation_id}",
      ...options,
    })
  }

  /**
   * Generate Sample Profile
   * Generate a sample profile with insights for testing
   */
  public static generateSampleProfile<ThrowOnError extends boolean = false>(
    options?: Options<ProfilesGenerateSampleProfileData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).post<
      unknown,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/generate-sample-profile",
      ...options,
    })
  }

  /**
   * Process All Conversations
   * Process all conversations for the current user to extract profile insights
   */
  public static processAllConversations<ThrowOnError extends boolean = false>(
    options?: Options<ProfilesProcessAllConversationsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).post<
      unknown,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/profiles/process-all-conversations",
      ...options,
    })
  }
}

export class DefaultService {
  /**
   * Chat
   * Process a chat message and analyze it for profile information
   */
  public static apiChat<ThrowOnError extends boolean = false>(
    options: Options<ApiChatData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      unknown,
      ApiChatError,
      ThrowOnError
    >({
      url: "/api/v1/chat/{user_id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  }

  /**
   * End Chat
   * End the conversation and perform comprehensive profile analysis
   */
  public static apiEndChat<ThrowOnError extends boolean = false>(
    options: Options<ApiEndChatData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      unknown,
      ApiEndChatError,
      ThrowOnError
    >({
      url: "/api/v1/chat/{user_id}/end",
      ...options,
    })
  }
}

export class NotificationsService {
  /**
   * Get User Notifications
   * Get notifications for the current user
   */
  public static getUserNotifications<ThrowOnError extends boolean = false>(
    options?: Options<NotificationsGetUserNotificationsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      NotificationsGetUserNotificationsResponse,
      NotificationsGetUserNotificationsError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/notifications/",
      ...options,
    })
  }

  /**
   * Mark Notification Opened
   * Mark a notification as opened
   */
  public static markNotificationOpened<ThrowOnError extends boolean = false>(
    options: Options<NotificationsMarkNotificationOpenedData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).post<
      unknown,
      NotificationsMarkNotificationOpenedError,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/notifications/mark-opened/{notification_id}",
      ...options,
    })
  }

  /**
   * Generate Notifications
   * Generate notifications based on user insights
   */
  public static generateNotifications<ThrowOnError extends boolean = false>(
    options?: Options<NotificationsGenerateNotificationsData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).post<
      NotificationsGenerateNotificationsResponse,
      unknown,
      ThrowOnError
    >({
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/notifications/generate",
      ...options,
    })
  }
}
