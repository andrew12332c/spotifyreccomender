import { useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Spinner,
  Button,
  Flex,
  Image,
} from "@chakra-ui/react";
import SearchBar from "../ui/Searchbar";
import TrackCard from "../ui/TrackCard";
import HistorySection from "../ui/HistorySection";
import PersonalizedSection from "../ui/PersonalizedSection";
import useSpotifyStore from "../../../store/useSpotifyStore";
import useDiscoveryStore from "../../../store/useDiscoveryStore";
import useLastfmStore from "../../../store/useLastfmStore";

export default function SearchAndResults() {
  const {
    selectedTrack,
    similar,
    discovery,
    isLoadingRecs,
    error,
    selectTrack,
    clearSelection,
    autoLoadFromHistory,
  } = useSpotifyStore();

  const { wildcards, isLoadingWildcards } = useDiscoveryStore();
  const { lastfmSimilar, lastfmArtists, isLoadingLastfm } = useLastfmStore();

  useEffect(() => {
    autoLoadFromHistory();
  }, [autoLoadFromHistory]);

  const allShownIds = new Set([
    ...similar.map((t) => t.id),
    ...discovery.map((t) => t.id),
  ]);
  const knownArtistIds = new Set([
    ...similar.flatMap((t) => t.artists.map((a) => a.id)),
    ...discovery.flatMap((t) => t.artists.map((a) => a.id)),
  ]);

  const uniqueWildcards = wildcards.filter(
    (t) => !knownArtistIds.has(t.artists[0]?.id) && !allShownIds.has(t.id)
  );
  const uniqueLastfmSimilar = lastfmSimilar.filter(
    (t) => !allShownIds.has(t.id)
  );
  const uniqueLastfmArtists = lastfmArtists.filter(
    (t) => !allShownIds.has(t.id)
  );

  return (
    <VStack spacing="8" w="100%" maxW="1100px" mx="auto" px="4" py="8">
      <SearchBar />

      <HistorySection />

      <PersonalizedSection />

      {error && (
        <Box
          bg={error.includes("429") ? "rgba(234, 179, 8, 0.12)" : "rgba(220, 38, 38, 0.15)"}
          border={error.includes("429") ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid rgba(220, 38, 38, 0.3)"}
          color={error.includes("429") ? "#fbbf24" : "#fca5a5"}
          px="4"
          py="3"
          borderRadius="md"
          w="100%"
          maxW="600px"
        >
          <Text fontSize="sm" fontWeight="600">
            {error.includes("429") ? "Spotify rate limit hit" : "Something went wrong"}
          </Text>
          <Text fontSize="xs" mt="1" opacity="0.8">
            {error.includes("429")
              ? "Too many requests — wait a minute or two and try again."
              : error}
          </Text>
        </Box>
      )}

      {selectedTrack && (
        <Box w="100%">
          {/* Seed track banner */}
          <HStack
            bg="#1e1e1e"
            p="4"
            borderRadius="lg"
            mb="6"
            justify="space-between"
            flexWrap="wrap"
            gap="3"
          >
            <HStack spacing="4">
              <Image
                src={selectedTrack.album.imageSmall || selectedTrack.album.image}
                alt={selectedTrack.album.name}
                boxSize="48px"
                borderRadius="md"
                objectFit="cover"
                flexShrink="0"
              />
              <Box>
                <Text color="#888" fontSize="xs">
                  Recommendations based on
                </Text>
                <Text color="white" fontWeight="600" fontSize="md">
                  {selectedTrack.name}
                </Text>
                <Text color="#1DB954" fontSize="sm">
                  {selectedTrack.artists.map((a) => a.name).join(", ")}
                </Text>
              </Box>
            </HStack>
            <Button
              size="sm"
              variant="ghost"
              color="#888"
              onClick={clearSelection}
              _hover={{ color: "white", bg: "#2a2a2a" }}
            >
              Clear
            </Button>
          </HStack>

          {isLoadingRecs ? (
            <VStack py="16" spacing="4">
              <Spinner size="xl" color="#1DB954" thickness="3px" />
              <Text color="#888">Finding recommendations...</Text>
            </VStack>
          ) : (
            <VStack spacing="8" align="stretch">
              <Flex
                gap="8"
                direction={{ base: "column", lg: "row" }}
                align="flex-start"
              >
                {/* Similar Tracks */}
                <Box flex="1" w="100%">
                  <Box mb="4">
                    <Heading size="md" color="white">
                      Similar Tracks
                    </Heading>
                    <Text color="#888" fontSize="xs" mt="1">
                      Songs with the same vibe — may include the same artist
                    </Text>
                  </Box>
                  <VStack spacing="2" align="stretch">
                    {similar.length > 0 ? (
                      similar.map((track) => (
                        <TrackCard
                          key={track.id}
                          track={track}
                          onSelect={selectTrack}
                        />
                      ))
                    ) : (
                      <Text color="#555" fontSize="sm" py="8" textAlign="center">
                        No similar tracks found
                      </Text>
                    )}
                  </VStack>
                </Box>

                {/* Discovery Tracks */}
                <Box flex="1" w="100%">
                  <Box mb="4">
                    <Heading size="md" color="white">
                      Discover Something New
                    </Heading>
                    <Text color="#888" fontSize="xs" mt="1">
                      Different artists with matching genre, tempo & energy
                    </Text>
                  </Box>
                  <VStack spacing="2" align="stretch">
                    {discovery.length > 0 ? (
                      discovery.map((track) => (
                        <TrackCard
                          key={track.id}
                          track={track}
                          onSelect={selectTrack}
                        />
                      ))
                    ) : (
                      <Text color="#555" fontSize="sm" py="8" textAlign="center">
                        No discovery tracks found
                      </Text>
                    )}
                  </VStack>
                </Box>
              </Flex>

              {/* Last.fm Scrobble Matches */}
              <Flex
                gap="8"
                direction={{ base: "column", lg: "row" }}
                align="flex-start"
              >
                <Box flex="1" w="100%">
                  <Box mb="4">
                    <HStack spacing="2" align="baseline">
                      <Heading size="md" color="white">
                        Scrobble Matches
                      </Heading>
                      <Text
                        fontSize="2xs"
                        fontWeight="700"
                        color="#f87171"
                        bg="rgba(213, 16, 7, 0.15)"
                        px="2"
                        py="0.5"
                        borderRadius="sm"
                      >
                        LAST.FM
                      </Text>
                    </HStack>
                    <Text color="#888" fontSize="xs" mt="1">
                      Tracks listeners play alongside this song
                    </Text>
                  </Box>
                  {isLoadingLastfm ? (
                    <HStack spacing="3" py="6" justify="center">
                      <Spinner size="sm" color="#d51007" thickness="2px" />
                      <Text color="#888" fontSize="sm">
                        Querying Last.fm scrobble data...
                      </Text>
                    </HStack>
                  ) : (
                    <VStack spacing="2" align="stretch">
                      {uniqueLastfmSimilar.length > 0 ? (
                        uniqueLastfmSimilar.map((track) => (
                          <TrackCard
                            key={track.id}
                            track={track}
                            onSelect={selectTrack}
                          />
                        ))
                      ) : (
                        <Text
                          color="#555"
                          fontSize="sm"
                          py="8"
                          textAlign="center"
                        >
                          No scrobble matches found
                        </Text>
                      )}
                    </VStack>
                  )}
                </Box>

                <Box flex="1" w="100%">
                  <Box mb="4">
                    <HStack spacing="2" align="baseline">
                      <Heading size="md" color="white">
                        Similar Artist Picks
                      </Heading>
                      <Text
                        fontSize="2xs"
                        fontWeight="700"
                        color="#f87171"
                        bg="rgba(213, 16, 7, 0.15)"
                        px="2"
                        py="0.5"
                        borderRadius="sm"
                      >
                        LAST.FM
                      </Text>
                    </HStack>
                    <Text color="#888" fontSize="xs" mt="1">
                      Top tracks from artists that Last.fm listeners also love
                    </Text>
                  </Box>
                  {isLoadingLastfm ? (
                    <HStack spacing="3" py="6" justify="center">
                      <Spinner size="sm" color="#d51007" thickness="2px" />
                      <Text color="#888" fontSize="sm">
                        Finding similar artists...
                      </Text>
                    </HStack>
                  ) : (
                    <VStack spacing="2" align="stretch">
                      {uniqueLastfmArtists.length > 0 ? (
                        uniqueLastfmArtists.map((track) => (
                          <TrackCard
                            key={track.id}
                            track={track}
                            onSelect={selectTrack}
                          />
                        ))
                      ) : (
                        <Text
                          color="#555"
                          fontSize="sm"
                          py="8"
                          textAlign="center"
                        >
                          No similar artist picks found
                        </Text>
                      )}
                    </VStack>
                  )}
                </Box>
              </Flex>

              {/* Wildcard Discoveries — ListenBrainz */}
              <Box w="100%">
                <Box mb="4">
                  <HStack spacing="2" align="baseline">
                    <Heading size="md" color="white">
                      Wildcard Discoveries
                    </Heading>
                    <Text
                      fontSize="2xs"
                      fontWeight="700"
                      color="#c084fc"
                      bg="rgba(168, 85, 247, 0.15)"
                      px="2"
                      py="0.5"
                      borderRadius="sm"
                    >
                      LISTENBRAINZ
                    </Text>
                  </HStack>
                  <Text color="#888" fontSize="xs" mt="1">
                    Artists you haven't heard — sourced from what similar
                    listeners enjoy
                  </Text>
                </Box>

                {isLoadingWildcards ? (
                  <HStack spacing="3" py="6" justify="center">
                    <Spinner size="sm" color="#a855f7" thickness="2px" />
                    <Text color="#888" fontSize="sm">
                      Searching ListenBrainz for wildcards...
                    </Text>
                  </HStack>
                ) : (
                  <Flex
                    gap="2"
                    direction={{ base: "column", md: "row" }}
                    flexWrap="wrap"
                  >
                    {uniqueWildcards.length > 0 ? (
                      uniqueWildcards.map((track) => (
                        <Box
                          key={track.id}
                          flex={{ base: "1 1 100%", md: "1 1 calc(50% - 4px)" }}
                          maxW={{ md: "calc(50% - 4px)" }}
                        >
                          <TrackCard track={track} onSelect={selectTrack} />
                        </Box>
                      ))
                    ) : (
                      <Text
                        color="#555"
                        fontSize="sm"
                        py="6"
                        textAlign="center"
                        w="100%"
                      >
                        No wildcard discoveries found for this artist
                      </Text>
                    )}
                  </Flex>
                )}
              </Box>
            </VStack>
          )}
        </Box>
      )}

      {!selectedTrack && !error && (
        <VStack py="16" spacing="3">
          <Text color="#555" fontSize="lg">
            Search for a song to get started
          </Text>
          <Text color="#444" fontSize="sm" maxW="400px" textAlign="center">
            Recommendations powered by Spotify, Last.fm scrobble data, and
            ListenBrainz collaborative filtering — three engines, one playlist.
          </Text>
        </VStack>
      )}
    </VStack>
  );
}
