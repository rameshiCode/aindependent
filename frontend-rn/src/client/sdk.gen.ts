// This file is auto-generated by @hey-api/openapi-ts

import {
  type Options as ClientOptions,
  type TDataShape,
  type Client,
  urlSearchParamsBodySerializer,
} from "@hey-api/client-fetch"
import type {
  LoginLoginGoogleData,
  LoginAuthGoogleData,
  LoginAuthGoogleError,
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
  StripeCreatePortalSessionData,
  StripeCreatePortalSessionResponse,
  StripeCreatePortalSessionError,
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
   * Login Google
   * Redirect users to Google for authentication
   */
  public static loginGoogle<ThrowOnError extends boolean = false>(
    options?: Options<LoginLoginGoogleData, ThrowOnError>,
  ) {
    return (options?.client ?? _heyApiClient).get<
      unknown,
      unknown,
      ThrowOnError
    >({
      url: "/api/v1/login/google",
      ...options,
    })
  }

  /**
   * Auth Google
   * Handle Google OAuth2 callback and issue a JWT token.
   */
  public static authGoogle<ThrowOnError extends boolean = false>(
    options: Options<LoginAuthGoogleData, ThrowOnError>,
  ) {
    return (options.client ?? _heyApiClient).get<
      unknown,
      LoginAuthGoogleError,
      ThrowOnError
    >({
      url: "/api/v1/login/auth/google",
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
   * This endpoint doesn't require authentication and can be used
   * to check if your server can communicate with Stripe.
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
   * Create a checkout session for a subscription.
   * This is called when a user wants to subscribe after reaching the free request limit.
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
   * Create Portal Session
   * Create a customer portal session for managing subscriptions.
   * This allows users to update payment methods, cancel subscriptions, etc.
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
   * Cancel a subscription directly (without portal).
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
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
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
      security: [
        {
          scheme: "bearer",
          type: "http",
        },
      ],
      url: "/api/v1/stripe/products/{product_id}/prices",
      ...options,
    })
  }
}
