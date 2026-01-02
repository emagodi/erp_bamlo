/**
 * An array of routes that are accessible to the public
 * These routes do not require authentication
 * @type {string[]}
 */

export const publicRoutes = [
    "/",
    "/login"
]

/**
 * An array of routes that are used for authentication
 * @type {string[]}
 */
export const authRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/verify",
    "/auth/registration",
    "/auth/change-password",
]

/**
 * The prefix for API auth routes
 * Routes that start with this prefix are used for API auth purposes
 * @type {string}
 */
export const apiAuthPrefix = "/api/auth"

/**
 * The default redirect path after loggin in
 * @type {string}
 */
export const DEFAULT_LOGIN_REDIRECT = '/dashboard'
