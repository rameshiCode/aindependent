// This file is auto-generated by @hey-api/openapi-ts

import {
  type Options,
  LoginService,
  UsersService,
  UtilsService,
  StripeService,
  OpenaiService,
} from "../sdk.gen"
import {
  queryOptions,
  type UseMutationOptions,
  type DefaultError,
} from "@tanstack/react-query"
import type {
  LoginAuthGoogleData,
  LoginAuthGoogleError,
  LoginAuthGoogleResponse,
  LoginAuthGoogle1Data,
  LoginLoginForAccessTokenData,
  LoginLoginForAccessTokenError,
  LoginLoginForAccessTokenResponse,
  LoginTestTokenData,
  LoginTestTokenResponse,
  LoginRecoverPasswordData,
  LoginRecoverPasswordError,
  LoginRecoverPasswordResponse,
  LoginResetPasswordData,
  LoginResetPasswordError,
  LoginResetPasswordResponse,
  LoginRecoverPasswordHtmlContentData,
  LoginRecoverPasswordHtmlContentError,
  LoginRecoverPasswordHtmlContentResponse,
  UsersReadUsersData,
  UsersCreateUserData,
  UsersCreateUserError,
  UsersCreateUserResponse,
  UsersDeleteUserMeData,
  UsersDeleteUserMeResponse,
  UsersReadUserMeData,
  UsersUpdateUserMeData,
  UsersUpdateUserMeError,
  UsersUpdateUserMeResponse,
  UsersUpdatePasswordMeData,
  UsersUpdatePasswordMeError,
  UsersUpdatePasswordMeResponse,
  UsersRegisterUserData,
  UsersRegisterUserError,
  UsersRegisterUserResponse,
  UsersDeleteUserData,
  UsersDeleteUserError,
  UsersDeleteUserResponse,
  UsersReadUserByIdData,
  UsersUpdateUserData,
  UsersUpdateUserError,
  UsersUpdateUserResponse,
  UtilsTestEmailData,
  UtilsTestEmailError,
  UtilsTestEmailResponse,
  UtilsHealthCheckData,
  StripeStripeWebhookData,
  StripeStripeWebhookError,
  StripeStripeWebhookResponse,
  StripeStripeHealthCheckData,
  StripeGetSubscriptionStatusData,
  StripeCreateCheckoutSessionData,
  StripeCreateCheckoutSessionError,
  StripeCreateCheckoutSessionResponse,
  StripeGetUsageStatusData,
  StripeIncrementUsageData,
  StripeIncrementUsageResponse,
  StripeGetAllSubscriptionsData,
  StripeCreateSubscriptionWithPaymentMethodData,
  StripeCreateSubscriptionWithPaymentMethodError,
  StripeCreateSubscriptionWithPaymentMethodResponse,
  StripeCancelSubscriptionData,
  StripeCancelSubscriptionError,
  StripeCancelSubscriptionResponse,
  StripeListPaymentMethodsData,
  StripeGetProductsData,
  StripeGetProductPricesData,
  StripeCreatePortalSessionData,
  StripeCreatePortalSessionError,
  StripeCreatePortalSessionResponse,
  StripeCreatePaymentIntentData,
  StripeCreatePaymentIntentError,
  StripeCreatePaymentIntentResponse,
  StripeConfirmSubscriptionData,
  StripeConfirmSubscriptionError,
  StripeConfirmSubscriptionResponse,
  OpenaiGetConversationsData,
  OpenaiCreateConversationData,
  OpenaiCreateConversationError,
  OpenaiCreateConversationResponse,
  OpenaiDeleteConversationData,
  OpenaiDeleteConversationError,
  OpenaiDeleteConversationResponse,
  OpenaiGetConversationData,
  OpenaiUpdateConversationData,
  OpenaiUpdateConversationError,
  OpenaiUpdateConversationResponse,
  OpenaiCreateMessageData,
  OpenaiCreateMessageError,
  OpenaiCreateMessageResponse,
} from "../types.gen"
import { client as _heyApiClient } from "../client.gen"

export type QueryKey<TOptions extends Options> = [
  Pick<TOptions, "baseUrl" | "body" | "headers" | "path" | "query"> & {
    _id: string
    _infinite?: boolean
  },
]

const createQueryKey = <TOptions extends Options>(
  id: string,
  options?: TOptions,
  infinite?: boolean,
): [QueryKey<TOptions>[0]] => {
  const params: QueryKey<TOptions>[0] = {
    _id: id,
    baseUrl: (options?.client ?? _heyApiClient).getConfig().baseUrl,
  } as QueryKey<TOptions>[0]
  if (infinite) {
    params._infinite = infinite
  }
  if (options?.body) {
    params.body = options.body
  }
  if (options?.headers) {
    params.headers = options.headers
  }
  if (options?.path) {
    params.path = options.path
  }
  if (options?.query) {
    params.query = options.query
  }
  return [params]
}

export const authGoogleQueryKey = (options: Options<LoginAuthGoogleData>) =>
  createQueryKey("loginAuthGoogle", options)

export const authGoogleOptions = (options: Options<LoginAuthGoogleData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.authGoogle({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: authGoogleQueryKey(options),
  })
}

export const authGoogleMutation = (
  options?: Partial<Options<LoginAuthGoogleData>>,
) => {
  const mutationOptions: UseMutationOptions<
    LoginAuthGoogleResponse,
    LoginAuthGoogleError,
    Options<LoginAuthGoogleData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await LoginService.authGoogle({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const authGoogle1QueryKey = (options: Options<LoginAuthGoogle1Data>) =>
  createQueryKey("loginAuthGoogle1", options)

export const authGoogle1Options = (options: Options<LoginAuthGoogle1Data>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.authGoogle1({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: authGoogle1QueryKey(options),
  })
}

export const loginForAccessTokenQueryKey = (
  options: Options<LoginLoginForAccessTokenData>,
) => createQueryKey("loginLoginForAccessToken", options)

export const loginForAccessTokenOptions = (
  options: Options<LoginLoginForAccessTokenData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.loginForAccessToken({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: loginForAccessTokenQueryKey(options),
  })
}

export const loginForAccessTokenMutation = (
  options?: Partial<Options<LoginLoginForAccessTokenData>>,
) => {
  const mutationOptions: UseMutationOptions<
    LoginLoginForAccessTokenResponse,
    LoginLoginForAccessTokenError,
    Options<LoginLoginForAccessTokenData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await LoginService.loginForAccessToken({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const testTokenQueryKey = (options?: Options<LoginTestTokenData>) =>
  createQueryKey("loginTestToken", options)

export const testTokenOptions = (options?: Options<LoginTestTokenData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.testToken({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: testTokenQueryKey(options),
  })
}

export const testTokenMutation = (
  options?: Partial<Options<LoginTestTokenData>>,
) => {
  const mutationOptions: UseMutationOptions<
    LoginTestTokenResponse,
    DefaultError,
    Options<LoginTestTokenData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await LoginService.testToken({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const recoverPasswordQueryKey = (
  options: Options<LoginRecoverPasswordData>,
) => createQueryKey("loginRecoverPassword", options)

export const recoverPasswordOptions = (
  options: Options<LoginRecoverPasswordData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.recoverPassword({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: recoverPasswordQueryKey(options),
  })
}

export const recoverPasswordMutation = (
  options?: Partial<Options<LoginRecoverPasswordData>>,
) => {
  const mutationOptions: UseMutationOptions<
    LoginRecoverPasswordResponse,
    LoginRecoverPasswordError,
    Options<LoginRecoverPasswordData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await LoginService.recoverPassword({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const resetPasswordQueryKey = (
  options: Options<LoginResetPasswordData>,
) => createQueryKey("loginResetPassword", options)

export const resetPasswordOptions = (
  options: Options<LoginResetPasswordData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.resetPassword({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: resetPasswordQueryKey(options),
  })
}

export const resetPasswordMutation = (
  options?: Partial<Options<LoginResetPasswordData>>,
) => {
  const mutationOptions: UseMutationOptions<
    LoginResetPasswordResponse,
    LoginResetPasswordError,
    Options<LoginResetPasswordData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await LoginService.resetPassword({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const recoverPasswordHtmlContentQueryKey = (
  options: Options<LoginRecoverPasswordHtmlContentData>,
) => createQueryKey("loginRecoverPasswordHtmlContent", options)

export const recoverPasswordHtmlContentOptions = (
  options: Options<LoginRecoverPasswordHtmlContentData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await LoginService.recoverPasswordHtmlContent({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: recoverPasswordHtmlContentQueryKey(options),
  })
}

export const recoverPasswordHtmlContentMutation = (
  options?: Partial<Options<LoginRecoverPasswordHtmlContentData>>,
) => {
  const mutationOptions: UseMutationOptions<
    LoginRecoverPasswordHtmlContentResponse,
    LoginRecoverPasswordHtmlContentError,
    Options<LoginRecoverPasswordHtmlContentData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await LoginService.recoverPasswordHtmlContent({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const readUsersQueryKey = (options?: Options<UsersReadUsersData>) =>
  createQueryKey("usersReadUsers", options)

export const readUsersOptions = (options?: Options<UsersReadUsersData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UsersService.readUsers({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: readUsersQueryKey(options),
  })
}

export const createUserQueryKey = (options: Options<UsersCreateUserData>) =>
  createQueryKey("usersCreateUser", options)

export const createUserOptions = (options: Options<UsersCreateUserData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UsersService.createUser({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createUserQueryKey(options),
  })
}

export const createUserMutation = (
  options?: Partial<Options<UsersCreateUserData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersCreateUserResponse,
    UsersCreateUserError,
    Options<UsersCreateUserData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.createUser({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const deleteUserMeMutation = (
  options?: Partial<Options<UsersDeleteUserMeData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersDeleteUserMeResponse,
    DefaultError,
    Options<UsersDeleteUserMeData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.deleteUserMe({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const readUserMeQueryKey = (options?: Options<UsersReadUserMeData>) =>
  createQueryKey("usersReadUserMe", options)

export const readUserMeOptions = (options?: Options<UsersReadUserMeData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UsersService.readUserMe({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: readUserMeQueryKey(options),
  })
}

export const updateUserMeMutation = (
  options?: Partial<Options<UsersUpdateUserMeData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersUpdateUserMeResponse,
    UsersUpdateUserMeError,
    Options<UsersUpdateUserMeData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.updateUserMe({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const updatePasswordMeMutation = (
  options?: Partial<Options<UsersUpdatePasswordMeData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersUpdatePasswordMeResponse,
    UsersUpdatePasswordMeError,
    Options<UsersUpdatePasswordMeData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.updatePasswordMe({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const registerUserQueryKey = (options: Options<UsersRegisterUserData>) =>
  createQueryKey("usersRegisterUser", options)

export const registerUserOptions = (
  options: Options<UsersRegisterUserData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UsersService.registerUser({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: registerUserQueryKey(options),
  })
}

export const registerUserMutation = (
  options?: Partial<Options<UsersRegisterUserData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersRegisterUserResponse,
    UsersRegisterUserError,
    Options<UsersRegisterUserData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.registerUser({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const deleteUserMutation = (
  options?: Partial<Options<UsersDeleteUserData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersDeleteUserResponse,
    UsersDeleteUserError,
    Options<UsersDeleteUserData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.deleteUser({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const readUserByIdQueryKey = (options: Options<UsersReadUserByIdData>) =>
  createQueryKey("usersReadUserById", options)

export const readUserByIdOptions = (
  options: Options<UsersReadUserByIdData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UsersService.readUserById({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: readUserByIdQueryKey(options),
  })
}

export const updateUserMutation = (
  options?: Partial<Options<UsersUpdateUserData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UsersUpdateUserResponse,
    UsersUpdateUserError,
    Options<UsersUpdateUserData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UsersService.updateUser({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const testEmailQueryKey = (options: Options<UtilsTestEmailData>) =>
  createQueryKey("utilsTestEmail", options)

export const testEmailOptions = (options: Options<UtilsTestEmailData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UtilsService.testEmail({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: testEmailQueryKey(options),
  })
}

export const testEmailMutation = (
  options?: Partial<Options<UtilsTestEmailData>>,
) => {
  const mutationOptions: UseMutationOptions<
    UtilsTestEmailResponse,
    UtilsTestEmailError,
    Options<UtilsTestEmailData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await UtilsService.testEmail({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const healthCheckQueryKey = (options?: Options<UtilsHealthCheckData>) =>
  createQueryKey("utilsHealthCheck", options)

export const healthCheckOptions = (options?: Options<UtilsHealthCheckData>) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await UtilsService.healthCheck({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: healthCheckQueryKey(options),
  })
}

export const stripeWebhookQueryKey = (
  options?: Options<StripeStripeWebhookData>,
) => createQueryKey("stripeStripeWebhook", options)

export const stripeWebhookOptions = (
  options?: Options<StripeStripeWebhookData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.stripeWebhook({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: stripeWebhookQueryKey(options),
  })
}

export const stripeWebhookMutation = (
  options?: Partial<Options<StripeStripeWebhookData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeStripeWebhookResponse,
    StripeStripeWebhookError,
    Options<StripeStripeWebhookData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.stripeWebhook({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const stripeHealthCheckQueryKey = (
  options?: Options<StripeStripeHealthCheckData>,
) => createQueryKey("stripeStripeHealthCheck", options)

export const stripeHealthCheckOptions = (
  options?: Options<StripeStripeHealthCheckData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.stripeHealthCheck({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: stripeHealthCheckQueryKey(options),
  })
}

export const getSubscriptionStatusQueryKey = (
  options?: Options<StripeGetSubscriptionStatusData>,
) => createQueryKey("stripeGetSubscriptionStatus", options)

export const getSubscriptionStatusOptions = (
  options?: Options<StripeGetSubscriptionStatusData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.getSubscriptionStatus({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getSubscriptionStatusQueryKey(options),
  })
}

export const createCheckoutSessionQueryKey = (
  options: Options<StripeCreateCheckoutSessionData>,
) => createQueryKey("stripeCreateCheckoutSession", options)

export const createCheckoutSessionOptions = (
  options: Options<StripeCreateCheckoutSessionData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.createCheckoutSession({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createCheckoutSessionQueryKey(options),
  })
}

export const createCheckoutSessionMutation = (
  options?: Partial<Options<StripeCreateCheckoutSessionData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeCreateCheckoutSessionResponse,
    StripeCreateCheckoutSessionError,
    Options<StripeCreateCheckoutSessionData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.createCheckoutSession({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const getUsageStatusQueryKey = (
  options?: Options<StripeGetUsageStatusData>,
) => createQueryKey("stripeGetUsageStatus", options)

export const getUsageStatusOptions = (
  options?: Options<StripeGetUsageStatusData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.getUsageStatus({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getUsageStatusQueryKey(options),
  })
}

export const incrementUsageQueryKey = (
  options?: Options<StripeIncrementUsageData>,
) => createQueryKey("stripeIncrementUsage", options)

export const incrementUsageOptions = (
  options?: Options<StripeIncrementUsageData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.incrementUsage({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: incrementUsageQueryKey(options),
  })
}

export const incrementUsageMutation = (
  options?: Partial<Options<StripeIncrementUsageData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeIncrementUsageResponse,
    DefaultError,
    Options<StripeIncrementUsageData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.incrementUsage({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const getAllSubscriptionsQueryKey = (
  options?: Options<StripeGetAllSubscriptionsData>,
) => createQueryKey("stripeGetAllSubscriptions", options)

export const getAllSubscriptionsOptions = (
  options?: Options<StripeGetAllSubscriptionsData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.getAllSubscriptions({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getAllSubscriptionsQueryKey(options),
  })
}

export const createSubscriptionWithPaymentMethodQueryKey = (
  options: Options<StripeCreateSubscriptionWithPaymentMethodData>,
) => createQueryKey("stripeCreateSubscriptionWithPaymentMethod", options)

export const createSubscriptionWithPaymentMethodOptions = (
  options: Options<StripeCreateSubscriptionWithPaymentMethodData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.createSubscriptionWithPaymentMethod({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createSubscriptionWithPaymentMethodQueryKey(options),
  })
}

export const createSubscriptionWithPaymentMethodMutation = (
  options?: Partial<Options<StripeCreateSubscriptionWithPaymentMethodData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeCreateSubscriptionWithPaymentMethodResponse,
    StripeCreateSubscriptionWithPaymentMethodError,
    Options<StripeCreateSubscriptionWithPaymentMethodData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.createSubscriptionWithPaymentMethod({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const cancelSubscriptionQueryKey = (
  options: Options<StripeCancelSubscriptionData>,
) => createQueryKey("stripeCancelSubscription", options)

export const cancelSubscriptionOptions = (
  options: Options<StripeCancelSubscriptionData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.cancelSubscription({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: cancelSubscriptionQueryKey(options),
  })
}

export const cancelSubscriptionMutation = (
  options?: Partial<Options<StripeCancelSubscriptionData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeCancelSubscriptionResponse,
    StripeCancelSubscriptionError,
    Options<StripeCancelSubscriptionData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.cancelSubscription({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const listPaymentMethodsQueryKey = (
  options?: Options<StripeListPaymentMethodsData>,
) => createQueryKey("stripeListPaymentMethods", options)

export const listPaymentMethodsOptions = (
  options?: Options<StripeListPaymentMethodsData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.listPaymentMethods({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: listPaymentMethodsQueryKey(options),
  })
}

export const getProductsQueryKey = (options?: Options<StripeGetProductsData>) =>
  createQueryKey("stripeGetProducts", options)

export const getProductsOptions = (
  options?: Options<StripeGetProductsData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.getProducts({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getProductsQueryKey(options),
  })
}

export const getProductPricesQueryKey = (
  options: Options<StripeGetProductPricesData>,
) => createQueryKey("stripeGetProductPrices", options)

export const getProductPricesOptions = (
  options: Options<StripeGetProductPricesData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.getProductPrices({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getProductPricesQueryKey(options),
  })
}

export const createPortalSessionQueryKey = (
  options: Options<StripeCreatePortalSessionData>,
) => createQueryKey("stripeCreatePortalSession", options)

export const createPortalSessionOptions = (
  options: Options<StripeCreatePortalSessionData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.createPortalSession({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createPortalSessionQueryKey(options),
  })
}

export const createPortalSessionMutation = (
  options?: Partial<Options<StripeCreatePortalSessionData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeCreatePortalSessionResponse,
    StripeCreatePortalSessionError,
    Options<StripeCreatePortalSessionData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.createPortalSession({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const createPaymentIntentQueryKey = (
  options: Options<StripeCreatePaymentIntentData>,
) => createQueryKey("stripeCreatePaymentIntent", options)

export const createPaymentIntentOptions = (
  options: Options<StripeCreatePaymentIntentData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.createPaymentIntent({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createPaymentIntentQueryKey(options),
  })
}

export const createPaymentIntentMutation = (
  options?: Partial<Options<StripeCreatePaymentIntentData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeCreatePaymentIntentResponse,
    StripeCreatePaymentIntentError,
    Options<StripeCreatePaymentIntentData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.createPaymentIntent({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const confirmSubscriptionQueryKey = (
  options: Options<StripeConfirmSubscriptionData>,
) => createQueryKey("stripeConfirmSubscription", options)

export const confirmSubscriptionOptions = (
  options: Options<StripeConfirmSubscriptionData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await StripeService.confirmSubscription({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: confirmSubscriptionQueryKey(options),
  })
}

export const confirmSubscriptionMutation = (
  options?: Partial<Options<StripeConfirmSubscriptionData>>,
) => {
  const mutationOptions: UseMutationOptions<
    StripeConfirmSubscriptionResponse,
    StripeConfirmSubscriptionError,
    Options<StripeConfirmSubscriptionData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await StripeService.confirmSubscription({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const getConversationsQueryKey = (
  options?: Options<OpenaiGetConversationsData>,
) => createQueryKey("openaiGetConversations", options)

export const getConversationsOptions = (
  options?: Options<OpenaiGetConversationsData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await OpenaiService.getConversations({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getConversationsQueryKey(options),
  })
}

export const createConversationQueryKey = (
  options: Options<OpenaiCreateConversationData>,
) => createQueryKey("openaiCreateConversation", options)

export const createConversationOptions = (
  options: Options<OpenaiCreateConversationData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await OpenaiService.createConversation({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createConversationQueryKey(options),
  })
}

export const createConversationMutation = (
  options?: Partial<Options<OpenaiCreateConversationData>>,
) => {
  const mutationOptions: UseMutationOptions<
    OpenaiCreateConversationResponse,
    OpenaiCreateConversationError,
    Options<OpenaiCreateConversationData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await OpenaiService.createConversation({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const deleteConversationMutation = (
  options?: Partial<Options<OpenaiDeleteConversationData>>,
) => {
  const mutationOptions: UseMutationOptions<
    OpenaiDeleteConversationResponse,
    OpenaiDeleteConversationError,
    Options<OpenaiDeleteConversationData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await OpenaiService.deleteConversation({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const getConversationQueryKey = (
  options: Options<OpenaiGetConversationData>,
) => createQueryKey("openaiGetConversation", options)

export const getConversationOptions = (
  options: Options<OpenaiGetConversationData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await OpenaiService.getConversation({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: getConversationQueryKey(options),
  })
}

export const updateConversationMutation = (
  options?: Partial<Options<OpenaiUpdateConversationData>>,
) => {
  const mutationOptions: UseMutationOptions<
    OpenaiUpdateConversationResponse,
    OpenaiUpdateConversationError,
    Options<OpenaiUpdateConversationData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await OpenaiService.updateConversation({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export const createMessageQueryKey = (
  options: Options<OpenaiCreateMessageData>,
) => createQueryKey("openaiCreateMessage", options)

export const createMessageOptions = (
  options: Options<OpenaiCreateMessageData>,
) => {
  return queryOptions({
    queryFn: async ({ queryKey, signal }) => {
      const { data } = await OpenaiService.createMessage({
        ...options,
        ...queryKey[0],
        signal,
        throwOnError: true,
      })
      return data
    },
    queryKey: createMessageQueryKey(options),
  })
}

export const createMessageMutation = (
  options?: Partial<Options<OpenaiCreateMessageData>>,
) => {
  const mutationOptions: UseMutationOptions<
    OpenaiCreateMessageResponse,
    OpenaiCreateMessageError,
    Options<OpenaiCreateMessageData>
  > = {
    mutationFn: async (localOptions) => {
      const { data } = await OpenaiService.createMessage({
        ...options,
        ...localOptions,
        throwOnError: true,
      })
      return data
    },
  }
  return mutationOptions
}

export { OpenaiService }
