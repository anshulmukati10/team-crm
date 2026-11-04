import axios from "axios";

axios.defaults.withCredentials = true;

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function getApiBase() {
  if (!API_BASE) {
    throw new Error("VITE_API_URL must be configured to use the company portal.");
  }
  return API_BASE;
}

function getError(error, fallback) {
  return new Error(error?.response?.data?.message || error?.message || fallback);
}

export async function registerCompany(company) {
  try {
    const response = await axios.post(`${getApiBase()}/company/register`, company);
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to register your company.");
  }
}

export async function companyLogin(credentials) {
  try {
    const response = await axios.post(
      `${getApiBase()}/company/login`,
      credentials,
    );
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to sign in to the company portal.");
  }
}

export async function companyLogout() {
  try {
    const response = await axios.post(`${getApiBase()}/company/logout`);
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to sign out of the company portal.");
  }
}

export async function getCompanyPlans() {
  try {
    const response = await axios.get(`${getApiBase()}/plans`);
    if (!Array.isArray(response.data?.plans)) {
      throw new Error("The plans service returned an invalid response.");
    }
    return response.data.plans;
  } catch (error) {
    throw getError(error, "Unable to load subscription plans.");
  }
}

export async function getCompanySubscriptions() {
  try {
    const response = await axios.get(`${getApiBase()}/company/subscription`);
    if (!Array.isArray(response.data)) {
      throw new Error("The subscription service returned an invalid response.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to load your subscription.");
  }
}

export async function subscribeCompany(planId) {
  try {
    const response = await axios.post(`${getApiBase()}/company/subscription`, {
      planId,
    });
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to update your subscription.");
  }
}

export async function createCompanyPayment(planId) {
  try {
    const response = await axios.post(`${getApiBase()}/payment/make-payment`, {
      planId,
    });
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to start your payment.");
  }
}

export async function confirmCompanyPayment(paymentId) {
  try {
    const response = await axios.post(`${getApiBase()}/payment/confirm-payment`, {
      paymentId,
    });
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to activate your subscription.");
  }
}

export async function createCompanyMember(member) {
  try {
    const response = await axios.post(
      `${getApiBase()}/company/create-member`,
      member,
    );
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to create the team member.");
  }
}

export async function getCompanyMembers() {
  try {
    const response = await axios.get(`${getApiBase()}/company/members`);
    if (!Array.isArray(response.data?.members)) {
      throw new Error("The company members service returned an invalid response.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to load company members.");
  }
}

export async function getCompanyWallet() {
  try {
    const response = await axios.get(`${getApiBase()}/company/wallet`);
    if (!Number.isFinite(Number(response.data?.balance))) {
      throw new Error("The company wallet service returned an invalid balance.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to load company wallet.");
  }
}

export async function getCompanyStripeBalance() {
  try {
    const response = await axios.get(`${getApiBase()}/company/stripe/balance`);
    const { connected, available, pending } = response.data || {};
    if (
      typeof connected !== "boolean" ||
      !Array.isArray(available) ||
      !Array.isArray(pending)
    ) {
      throw new Error("The Stripe balance service returned an invalid response.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to load your Stripe balance.");
  }
}

export function formatStripeAmounts(amounts) {
  if (!amounts?.length) return "—";
  return amounts
    .map(({ amount, currency }) => {
      const code = String(currency).toUpperCase();
      const formatter = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
      });
      const divisor = 10 ** formatter.resolvedOptions().maximumFractionDigits;
      return formatter.format(Number(amount) / divisor);
    })
    .join(" · ");
}

export async function creditCompanyWallet(balance) {
  try {
    const response = await axios.post(`${getApiBase()}/company/wallet/credit`, {
      balance,
    });
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to add funds to the company wallet.");
  }
}

export async function getCompanyOrders() {
  try {
    const response = await axios.get(`${getApiBase()}/company/orders`);
    if (!Array.isArray(response.data)) {
      throw new Error("The company orders service returned an invalid response.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to load company orders.");
  }
}

export async function getCompanyStripeStatus() {
  try {
    const response = await axios.get(`${getApiBase()}/company/stripe/status`);
    if (typeof response.data?.connected !== "boolean") {
      throw new Error("The Stripe service returned an invalid account status.");
    }
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404 && error.response.data?.connected === false) {
      return { connected: false };
    }
    throw getError(error, "Unable to load your Stripe account status.");
  }
}

export async function createCompanyStripeOnboarding() {
  try {
    const response = await axios.post(
      `${getApiBase()}/company/stripe/onboarding`,
    );
    if (typeof response.data?.onboardingUrl !== "string") {
      throw new Error("The Stripe service did not return an onboarding link.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to start Stripe account setup.");
  }
}

export async function getCompanyRecordings() {
  try {
    const response = await axios.get(`${getApiBase()}/company/get-recordings`);
    if (!Array.isArray(response.data)) {
      throw new Error("The company recordings service returned an invalid response.");
    }
    return response.data;
  } catch (error) {
    throw getError(error, "Unable to load company recordings.");
  }
}
