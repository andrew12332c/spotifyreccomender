import {
  Box,
  VStack,
  HStack,
  Image,
  Text,
  Heading,
  Button,
  IconButton,
} from "@chakra-ui/react";
import usePlaylistStore from "../../../store/usePlaylistStore";
import useSpotifyStore from "../../../store/useSpotifyStore";

export default function PlaylistSidebar() {
  const { playlist, removeFromPlaylist, clearPlaylist } = usePlaylistStore();
  const selectTrack = useSpotifyStore((s) => s.selectTrack);

  return (
    <Box
      w="300px"
      minW="300px"
      bg="#0a0a0a"
      borderLeft="1px solid #1e1e1e"
      h="calc(100vh - 150px)"
      position="sticky"
      top="150px"
      overflowY="auto"
      display={{ base: "none", xl: "block" }}
      css={{
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          background: "#333",
          borderRadius: "2px",
        },
      }}
    >
      <Box p="4" borderBottom="1px solid #1e1e1e" position="sticky" top="0" bg="#0a0a0a" zIndex="1">
        <HStack justify="space-between">
          <VStack align="flex-start" spacing="0">
            <Heading size="sm" color="white">
              My Playlist
            </Heading>
            <Text color="#666" fontSize="xs">
              {playlist.length} {playlist.length === 1 ? "track" : "tracks"}
            </Text>
          </VStack>
          {playlist.length > 0 && (
            <Button
              size="xs"
              variant="ghost"
              color="#666"
              onClick={clearPlaylist}
              _hover={{ color: "#aaa", bg: "#1e1e1e" }}
            >
              Clear
            </Button>
          )}
        </HStack>
      </Box>

      <VStack spacing="0" align="stretch">
        {playlist.length === 0 ? (
          <VStack py="12" spacing="2">
            <Text color="#444" fontSize="2xl">
              +
            </Text>
            <Text color="#555" fontSize="sm" textAlign="center" px="4">
              Add tracks from recommendations to build your playlist
            </Text>
          </VStack>
        ) : (
          playlist.map((track, idx) => (
            <HStack
              key={track.id}
              p="2"
              px="4"
              spacing="3"
              _hover={{ bg: "#141414" }}
              cursor="pointer"
              onClick={() => selectTrack(track)}
              role="group"
            >
              <Text color="#555" fontSize="xs" w="16px" textAlign="right" flexShrink="0">
                {idx + 1}
              </Text>
              <Image
                src={track.album.imageSmall || track.album.image}
                alt={track.name}
                boxSize="36px"
                borderRadius="sm"
                objectFit="cover"
                flexShrink="0"
                fallbackSrc="https://via.placeholder.com/36/1e1e1e/666?text=+"
              />
              <Box flex="1" minW="0">
                <Text color="white" fontSize="xs" fontWeight="500" noOfLines={1}>
                  {track.name}
                </Text>
                <Text color="#888" fontSize="2xs" noOfLines={1}>
                  {track.artists.map((a) => a.name).join(", ")}
                </Text>
              </Box>
              <Box
                opacity="0"
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.15s"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromPlaylist(track.id);
                }}
                cursor="pointer"
                color="#666"
                _hover={{ color: "#f87171" }}
                fontSize="sm"
                flexShrink="0"
                px="1"
              >
                x
              </Box>
            </HStack>
          ))
        )}
      </VStack>

      {playlist.length > 0 && (
        <Box p="4" borderTop="1px solid #1e1e1e">
          <Text color="#555" fontSize="2xs" textAlign="center">
            Total: {formatTotalDuration(playlist)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function formatTotalDuration(tracks) {
  const totalMs = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
  const mins = Math.floor(totalMs / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs} hr ${remainMins} min`;
}
