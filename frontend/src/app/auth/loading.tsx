import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export default function AuthLoading() {
  return (
    <div id="main-content" className="flex min-h-72 items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
