import { Box, Image, Text, HStack, Link, Badge } from "@chakra-ui/react";
import usePlaylistStore from "../../../store/usePlaylistStore";

const SOURCE_STYLES = {
  listenbrainz: { border: "#a855f7", bg: "rgba(168, 85, 247, 0.2)", color: "#c084fc", label: "LB" },
  lastfm: { border: "#d51007", bg: "rgba(213, 16, 7, 0.2)", color: "#f87171", label: "FM" },
};

export default function TrackCard({ track, onSelect }) {
  const duration = formatDuration(track.durationMs);
  const src = SOURCE_STYLES[track.source];
  const { addToPlaylist, removeFromPlaylist } = usePlaylistStore();
  const inPlaylist = usePlaylistStore((s) => s.playlist.some((t) => t.id === track.id));

  const handlePlaylistToggle = (e) => {
    e.stopPropagation();
    if (inPlaylist) {
      removeFromPlaylist(track.id);
    } else {
      addToPlaylist(track);
    }
  };

  return (
    <Box
      bg="#181818"
      borderRadius="lg"
      overflow="hidden"
      cursor={onSelect ? "pointer" : "default"}
      onClick={() => onSelect?.(track)}
      _hover={onSelect ? { bg: "#252525", transform: "translateY(-1px)" } : {}}
      transition="all 0.15s"
      w="100%"
      borderLeft={src ? `3px solid ${src.border}` : "3px solid transparent"}
      role="group"
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
            {track.album.name}{duration && ` \u00B7 ${duration}`}
          </Text>
        </Box>

        {/* Add / Remove from playlist */}
        <Box
          onClick={handlePlaylistToggle}
          cursor="pointer"
          flexShrink="0"
          w="28px"
          h="28px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          border="1px solid"
          borderColor={inPlaylist ? "#1DB954" : "#555"}
          color={inPlaylist ? "#1DB954" : "#555"}
          bg={inPlaylist ? "rgba(29, 185, 84, 0.1)" : "transparent"}
          _hover={{
            borderColor: inPlaylist ? "#f87171" : "#1DB954",
            color: inPlaylist ? "#f87171" : "#1DB954",
            bg: inPlaylist ? "rgba(248, 113, 113, 0.1)" : "rgba(29, 185, 84, 0.1)",
          }}
          transition="all 0.15s"
          fontSize="md"
          fontWeight="300"
          lineHeight="1"
          title={inPlaylist ? "Remove from playlist" : "Add to playlist"}
        >
          {inPlaylist ? "\u2713" : "+"}
        </Box>

        {track.externalUrl && (
          <Link
            href={track.externalUrl}
            isExternal
            onClick={(e) => e.stopPropagation()}
            color="#1DB954"
            fontSize="xs"
            fontWeight="700"
            flexShrink="0"
            letterSpacing="0.5px"
            _hover={{ color: "#1ed760", textDecoration: "none" }}
          >
            OPEN
          </Link>
        )}
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
