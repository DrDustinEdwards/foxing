import { Banner } from "capsomer/react/banner";

// The line every chart demo (/demos/*) opens with, in Capsomer's notice banner: the page is a signed-in
// page drawn with made-up numbers, so a reader and a live check can see its charts without an account.
export function DemoNotice() {
  return (
    <Banner tone="info" title="Demo with sample data">
      This is how the page looks for a signed-in reader. The numbers are made up, and nothing here
      belongs to a real account.
    </Banner>
  );
}
