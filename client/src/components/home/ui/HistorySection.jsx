import {
  Box,
  HStack,
  VStack,
  Image,
  Text,
  Button,
  Heading,
} from "@chakra-ui/react";
import useHistoryStore from "../../../store/useHistoryStore";
import useSpotifyStore from "../../../store/useSpotifyStore";

export default function HistorySection() {
  const { history, clearHistory } = useHistoryStore();
  const selectTrack = useSpotifyStore((s) => s.selectTrack);

  if (history.length === 0) return null;

  return (
    <Box w="100%">
      <HStack justify="space-between" mb="3">
        <VStack align="flex-start" spacing="0">
          <Heading size="sm" color="white">
            Recently Explored
          </Heading>
          <Text color="#666" fontSize="xs">
            Click any track to get fresh recommendations
          </Text>
        </VStack>
        <Button
          size="xs"
          variant="ghost"
          color="#666"
          onClick={clearHistory}
          _hover={{ color: "#aaa", bg: "#1e1e1e" }}
        >
          Clear
        </Button>
      </HStack>

      <Box
        overflowX="auto"
        mx="-4"
        px="4"
        pb="2"
        css={{
          "&::-webkit-scrollbar": { height: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "#333",
            borderRadius: "2px",
          },
        }}
      >
        <HStack spacing="3" w="max-content">
          {history.slice(0, 20).map((track) => (
            <Box
              key={track.id}
              cursor="pointer"
              onClick={() => selectTrack(track)}
              _hover={{ transform: "translateY(-2px)" }}
              transition="transform 0.15s"
              w="100px"
              flexShrink="0"
            >
              <Image
                src={track.album.imageSmall || track.album.image}
                alt={track.name}
                boxSize="100px"
                borderRadius="md"
                objectFit="cover"
                fallbackSrc="https://via.placeholder.com/100/1e1e1e/666?text=+"
              />
              <Text
                color="white"
                fontSize="xs"
                fontWeight="500"
                mt="1.5"
                noOfLines={1}
              >
                {track.name}
              </Text>
              <Text color="#888" fontSize="2xs" noOfLines={1}>
                {track.artists.map((a) => a.name).join(", ")}
              </Text>
            </Box>
          ))}
        </HStack>
      </Box>
    </Box>
  );
}
