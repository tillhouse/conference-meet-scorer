import { Suspense } from "react";
import NewMeetPage from "./page";

export default function NewMeetPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewMeetPage />
    </Suspense>
  );
}
