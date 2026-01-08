import { useAuth } from "@/contexts/useAuth";

export default function EnterpriseLoginScreen() {
  const { login, loading, error } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-40 h-10 rounded-2xl flex items-center justify-center">
            <img src="/image.png" alt="MCPX Logo" className="w-20 h-20" />
          </div>
        </div>
        <h2 className="mt-8 text-center text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-500 to-pink-500 bg-clip-text text-transparent">
          MCPX Control Panel
        </h2>
        <p className="mt-2 text-center text-lg font-medium text-black">
          by lunar.dev
        </p>
        <p className="mt-1 text-center text-sm text-black">
          Control Plane Management
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 backdrop-blur-sm py-10 px-6 shadow-2xl sm:rounded-2xl sm:px-10 border border-pink-100">
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              Welcome !
            </h3>
            <p className="text-sm text-gray-600 mb-8">
              Sign in to access your MCPX control plane dashboard
            </p>

            <button
              onClick={() => login()}
              disabled={loading}
              className="w-full flex justify-center items-center px-6 py-4 text-base font-semibold rounded-xl text-lunar-purple border-lunar-purple border-2 hover:bg-lunar-purple hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lunar-purple focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-2xl shadow-lunar-purple/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
              ) : (
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
              )}
              {loading ? "Connecting..." : "Sign in"}
            </button>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-lunar-purple"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
