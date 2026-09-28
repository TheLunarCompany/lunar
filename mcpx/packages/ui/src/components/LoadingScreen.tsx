export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mcpx-page">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-mcpx-border border-t-mcpx-selected"></div>
        <p className="text-mcpx-text-secondary">Checking authentication...</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
