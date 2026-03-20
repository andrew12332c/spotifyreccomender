import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  SimpleGrid,
  Image,
  Badge,
} from "@chakra-ui/react";
import useHistoryPoolStore from "../../../store/useHistoryPoolStore";
import useSpotifyStore from "../../../store/useSpotifyStore";

export default function FromHistorySection() {
  const fromHistory = useHistoryPoolStore((s) => s.fromHistory);
  const selectTrack = useSpotifyStore((s) => s.selectTrack);

  if (!fromHistory || fromHistory.length === 0) return null;

  return (
    <Box w="100%">
      <HStack spacing="3" mb="1" align="baseline" flexWrap="wrap">
        <Heading size="sm" color="white">
          From Your History
        </Heading>
        <Text
          fontSize="2xs"
          fontWeight="700"
          color="#f59e0b"
          bg="rgba(245, 158, 11, 0.12)"
          px="2"
          py="0.5"
          borderRadius="sm"
        >
          CACHED
        </Text>
      </HStack>
      <Text color="#666" fontSize="xs" mb="4">
        Picks from your last session — no API call needed
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="2">
        {fromHistory.map((track) => (
          <HistoryCacheCard key={track.id} track={track} onSelect={selectTrack} />
        ))}
      </SimpleGrid>
    </Box>
  );
}

function HistoryCacheCard({ track, onSelect }) {
  const duration = formatDuration(track.durationMs);

  const SOURCE_STYLES = {
    listenbrainz: { border: "#a855f7", bg: "rgba(168, 85, 247, 0.2)", color: "#c084fc", label: "LB" },
    lastfm: { border: "#d51007", bg: "rgba(213, 16, 7, 0.2)", color: "#f87171", label: "FM" },
  };
  const src = SOURCE_STYLES[track.source];

  return (
    <Box
      bg="#181818"
      borderRadius="lg"
      overflow="hidden"
      cursor="pointer"
      onClick={() => onSelect?.(track)}
      _hover={{ bg: "#252525", transform: "translateY(-1px)" }}
      transition="all 0.15s"
      w="100%"
      borderLeft={src ? `3px solid ${src.border}` : "3px solid #f59e0b"}
    >
      <HStack spacing="3" p="3" align="center">
        <Image
          src={track.album.imageSmall || track.album.image}
          alt={track.album.name}
          boxSize="52px"
          borderRadius="md"
          objectFit="cover"
          flexShrink="0"
          fallbackSrc="https://via.placeholder.com/52/1e1e1e/666?text=+"
        />
        <Box flex="1" minW="0">
          <HStack spacing="2" align="center">
            <Text color="white" fontSize="sm" fontWeight="600" noOfLines={1}>
              {track.name}
            </Text>
            {src && (
              <Badge
                bg={src.bg}
                color={src.color}
                fontSize="2xs"
                px="1.5"
                py="0.5"
                borderRadius="sm"
                fontWeight="700"
                flexShrink="0"
              >
                {src.label}
              </Badge>
            )}
          </HStack>
          <Text color="#b3b3b3" fontSize="xs" noOfLines={1}>
            {track.artists.map((a) => a.name).join(", ")}
          </Text>
          <Text color="#666" fontSize="xs" noOfLines={1}>
            {track.album.name}
            {duration && ` · ${duration}`}
          </Text>
        </Box>
      </HStack>
    </Box>
  );
}

function formatDuration(ms) {
  if (!ms) return "";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
