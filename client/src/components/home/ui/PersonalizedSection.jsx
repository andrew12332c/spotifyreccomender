import { useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Spinner,
  SimpleGrid,
} from "@chakra-ui/react";
import TrackCard from "./TrackCard";
import useSpotifyStore from "../../../store/useSpotifyStore";
import useHistoryStore from "../../../store/useHistoryStore";
import usePlaylistStore from "../../../store/usePlaylistStore";

const SOURCE_LABELS = {
  lastfm: { color: "#f87171", bg: "rgba(213, 16, 7, 0.12)", label: "LAST.FM" },
  listenbrainz: { color: "#c084fc", bg: "rgba(168, 85, 247, 0.12)", label: "LISTENBRAINZ" },
};

export default function PersonalizedSection() {
  const {
    forYou,
    forYouSources,
    isLoadingForYou,
    forYouLoaded,
    fetchPersonalized,
    selectTrack,
  } = useSpotifyStore();
  const historyCount = useHistoryStore((s) => s.history.length);
  const playlistCount = usePlaylistStore((s) => s.playlist.length);

  const hasSources = historyCount > 0 || playlistCount > 0;

  useEffect(() => {
    if (hasSources && !forYouLoaded) {
      fetchPersonalized();
    }
  }, [hasSources, forYouLoaded, fetchPersonalized]);

  if (!hasSources) return null;

  const activeSources = Object.entries(forYouSources || {}).filter(([, v]) => v > 0);

  return (
    <Box w="100%">
      <HStack spacing="3" mb="1" align="baseline" flexWrap="wrap">
        <Heading size="sm" color="white">
          For You
        </Heading>
        {activeSources.length > 0
          ? activeSources.map(([key]) => {
              const s = SOURCE_LABELS[key];
              return s ? (
                <Text
                  key={key}
                  fontSize="2xs"
                  fontWeight="700"
                  color={s.color}
                  bg={s.bg}
                  px="2"
                  py="0.5"
                  borderRadius="sm"
                >
                  {s.label}
                </Text>
              ) : null;
            })
          : (
            <Text
              fontSize="2xs"
              fontWeight="700"
              color="#1DB954"
              bg="rgba(29, 185, 84, 0.12)"
              px="2"
              py="0.5"
              borderRadius="sm"
            >
              PERSONALIZED
            </Text>
          )}
      </HStack>
      <Text color="#666" fontSize="xs" mb="4">
        Based on your{" "}
        {historyCount > 0
          ? `${historyCount} explored track${historyCount === 1 ? "" : "s"}`
          : ""}
        {historyCount > 0 && playlistCount > 0 ? " + " : ""}
        {playlistCount > 0
          ? `${playlistCount} playlist track${playlistCount === 1 ? "" : "s"}`
          : ""}
        {activeSources.length > 1
          ? ` \u00B7 powered by ${activeSources.map(([k]) => SOURCE_LABELS[k]?.label || k).join(", ")}`
          : ""}
      </Text>

      {isLoadingForYou ? (
        <HStack spacing="3" py="6" justify="center">
          <Spinner size="sm" color="#1DB954" thickness="2px" />
          <Text color="#888" fontSize="sm">
            Building personalized picks from 3 engines...
          </Text>
        </HStack>
      ) : forYou.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="2">
          {forYou.map((track) => (
            <TrackCard key={track.id} track={track} onSelect={selectTrack} />
          ))}
        </SimpleGrid>
      ) : (
        <Text color="#555" fontSize="sm" py="4" textAlign="center">
          No personalized picks available yet
        </Text>
      )}
    </Box>
  );
}
