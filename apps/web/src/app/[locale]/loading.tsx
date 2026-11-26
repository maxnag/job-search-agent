import { Center, Loader } from '@mantine/core';

/**
 * Shown while a page of the section loads — Next wraps the page in Suspense with this as the fallback
 *
 * @returns {React.JSX.Element}
 */
export default function Loading(): React.JSX.Element {
  return (
    <Center py="xl">
      <Loader size="sm" />
    </Center>
  );
}
