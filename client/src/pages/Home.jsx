import { Box, Flex } from "@chakra-ui/react";
import Navbar from "../components/home/layout/Navbar";
import SearchAndResults from "../components/home/layout/SearchAndResults";
import PlaylistSidebar from "../components/home/layout/PlaylistSidebar";

export default function Home() {
  return (
    <>
      <Navbar />
      <Flex>
        <Box flex="1" minW="0" overflowY="auto">
          <SearchAndResults />
        </Box>
        <PlaylistSidebar />
      </Flex>
    </>
  );
}
